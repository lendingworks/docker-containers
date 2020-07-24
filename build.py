#!/usr/bin/env python3

import argparse
import logging
import os
import signal
import subprocess
import threading
import time
from concurrent.futures.thread import ThreadPoolExecutor
from typing import Dict, Optional, Iterable, List

import yaml

NAMESPACE: str = 'lendingworks'
MANIFEST_FILE: str = 'manifest.yaml'
LOADED_MANIFEST: Optional[Dict] = None
WATCHED_SIGNALS = {
    signal.SIGINT: 'SIGINT',
    signal.SIGTERM: 'SIGTERM',
    signal.SIGQUIT: 'SIGQUIT',
}
EXIT_SIGNAL = False
EXIT_FAILURE = False
THREAD_LOCK: Optional[threading.Lock] = None


def parse_cli_args() -> Dict:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        '--parallel',
        help='The number of builds to run in parallel. '
             'If not specified, builds will run sequentially',
        metavar='COUNT',
        type=int,
    )

    parser.add_argument(
        '--container',
        help='Build a specific container',
        metavar='NAME',
        type=str,
    )

    parser.add_argument(
        '--push',
        help='Push built images',
        action='store_true',
    )

    parser.add_argument(
        '--silent',
        help='Hides Docker build output',
        action='store_true',
    )

    args = parser.parse_args()
    parsed = vars(args)

    if parsed['container'] is not None and parsed['parallel'] is not None:
        print("Both '--container' and '--parallel' were specified, ignoring '--parallel'")
        parsed['parallel'] = None

    return parsed


def parse_manifest() -> Dict:
    global LOADED_MANIFEST
    if LOADED_MANIFEST is None:
        with open(MANIFEST_FILE, 'r') as stream:
            manifest = yaml.safe_load(stream)
            LOADED_MANIFEST = manifest['containers']
    return LOADED_MANIFEST


def parse_container(raw_container: Dict) -> Optional[Dict]:
    parsed = raw_container
    if 'dockerfile' not in parsed:
        parsed['dockerfile'] = 'Dockerfile'

    parsed['dockerfile'] = f"{parsed['path']}/{parsed['dockerfile']}"

    if 'build_args' not in parsed:
        parsed['build_args'] = []

    if 'tags' not in parsed:
        parsed['tags'] = ['latest']

    raw_tags = parsed['tags']
    parsed['tags'] = [f"{NAMESPACE}/{parsed['name']}:{tag}" for tag in raw_tags]

    return parsed


def get_containers(name: Optional[str] = None) -> Iterable:
    for container in parse_manifest():
        parsed = parse_container(container)
        if parsed is not None and (name is None or parsed['name'] == name):
            yield parsed


def build(
    push: bool,
    silent: bool,
    logger: logging.Logger,
    parallel_count: Optional[int] = None,
    container: Optional[str] = None
) -> None:
    if parallel_count is not None:
        return build_parallel(parallel_count, push, silent, logger)
    return build_sync(push, silent, logger, container)


def build_sync(
    push: bool,
    silent: bool,
    logger: logging.Logger,
    container_name: Optional[str] = None
) -> None:
    for container in get_containers(container_name):
        if EXIT_SIGNAL:
            return

        success = trigger_build(
            logger=logger,
            name=container['name'],
            dockerfile_name=container['dockerfile'],
            context_path=container['path'],
            tags=container['tags'],
            build_args=container['build_args'],
            push=push,
            silent=silent,
        )

        if not success:
            logger.error(f"Build for container '{container['name']}' has failed")
            return


def build_parallel(count: int, push: bool, silent: bool, logger: logging.Logger) -> None:
    with ThreadPoolExecutor(count) as pool:
        for container in get_containers():
            if EXIT_SIGNAL:
                return

            pool.submit(
                trigger_build,
                logger,
                container['name'],
                container['dockerfile'],
                container['path'],
                container['tags'],
                container['build_args'],
                push,
                silent,
                True,
            )


def trigger_build(
    logger: logging.Logger,
    name: str,
    dockerfile_name: str,
    context_path: str,
    tags: List[str],
    build_args: List[str],
    push: bool,
    silent: bool,
    is_parallel: bool = False,
) -> bool:
    global EXIT_SIGNAL, EXIT_FAILURE

    if EXIT_SIGNAL:
        return True

    log = logger.getChild(f"container({name})")
    tag_names = ','.join(tags)
    log.info(f"Building container {name} with tags: {tag_names}")

    tag_args = [f"--tag={tag}" for tag in tags]
    buildarg_args = [f"--build-arg={arg}" for arg in build_args]

    cli_args = ['docker', 'build', '--pull']
    cli_args += tag_args
    cli_args += buildarg_args
    cli_args += [f"--file={dockerfile_name}", context_path]

    cmd = ' '.join(cli_args)
    log.debug(f"Running: {cmd}")

    stdout = subprocess.PIPE if silent else None
    stderr = subprocess.PIPE if silent else None

    p = subprocess.Popen(
        args=cli_args,
        stdout=stdout,
        stderr=stderr,
    )

    while p.poll() is None:
        if EXIT_SIGNAL:
            log.debug('Exit signal received, stopping build')
            p.kill()
            return True
        time.sleep(1)

    if p.returncode != 0:
        log.error('Build has failed')
        if is_parallel:
            with THREAD_LOCK:
                EXIT_SIGNAL = True
                EXIT_FAILURE = p.returncode
        return False

    if EXIT_SIGNAL:
        return True

    log.info('Build complete')

    if push:
        log.info('Also pushing image to registry')
        for tag in tags:
            log.info(f"Pushing tag {tag}")

            push_args = ['docker', 'push', tag]
            cmd = ' '.join(push_args)
            log.debug(f"Running: {cmd}")

            p = subprocess.Popen(
                args=push_args,
                stdout=stdout,
                stderr=stderr,
            )

            while p.poll():
                if EXIT_SIGNAL:
                    log.debug('Exit signal received, stopping push')
                    p.kill()
                    return True
                time.sleep(1)

            if p.returncode != 0:
                log.error('Build has failed')
                if is_parallel:
                    with THREAD_LOCK:
                        EXIT_SIGNAL = True
                        EXIT_FAILURE = p.returncode
                return False

            log.info('Push complete')

    return True


def signal_handler(signal_number, frame):
    sig_name = WATCHED_SIGNALS[signal_number]
    print(f"Received signal: {signal_number} ({sig_name})")

    # Tell our threads to exit.
    global EXIT_SIGNAL
    EXIT_SIGNAL = True


def main():
    logging.basicConfig(
        format='%(asctime)s [%(name)-32s] [%(levelname)-8s] %(message)s',
        datefmt='%Y-%m-%dT%H:%M:%S'
    )
    logger = logging.getLogger()
    logger.setLevel(level=os.getenv('LOG_LEVEL', 'DEBUG'))

    cli_args = parse_cli_args()

    if cli_args['parallel']:
        global THREAD_LOCK
        THREAD_LOCK = threading.Lock()
        for signum in WATCHED_SIGNALS.keys():
            signal.signal(signum, signal_handler)

    build(
        push=cli_args['push'],
        silent=cli_args['silent'],
        parallel_count=cli_args['parallel'],
        container=cli_args['container'],
        logger=logger,
    )

    if EXIT_FAILURE is not None:
        exit(EXIT_FAILURE)


if __name__ == '__main__':
    main()

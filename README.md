# docker-containers

A collection of Docker containers, optimised for Kubernetes, used by the 
Lending Works platform.

# Containers
See the `manifest.yaml` file for details of all containers in this repository.

# Building
Use `build.py` to build all containers in this repository:

```shell script
pip install -r requirements.txt
./build.py
```

See `./build.py --help` for more options.

# Developing
To add a new container, create a new directory and all of your container
configuration.

Then update `manifest.yaml` with details of your new container.

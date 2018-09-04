#!/usr/bin/env ruby

TAG_PREFIX = "lendingworks"
PHP_VERSIONS = ["7.1", "7.2"]
NGINX_VERSION = "1.13"
RSYSLOG_VERSION = "8.31.0-r0"
ALPINE_VERSION = "3.7"

def get_timestamp
  Time.now.strftime("%d/%m/%Y %H:%M:%S")
end

def system! (cmd:, env: {}, ignore_exit: false)
  green_code = 32
  puts "\e[#{green_code}m[#{get_timestamp}] #{cmd}\e[0m"
  system(env, cmd)

  # Non-zero exit on failure.
  exit $?.exitstatus unless $?.success? or ignore_exit
end

def get_build_cmd (tag:, dir:, args: {}, pull: true)
  build_args = args.empty? ? "" : args.map{|k,v| " --build-arg \"#{k}=#{v}\""}.join
  full_tag = "#{TAG_PREFIX}/#{tag}"
  pull_arg = pull ? " --pull" : ""
  "docker build#{pull_arg} --force-rm#{build_args} -t #{full_tag} #{dir}"
end

def build(tag:, dir:, args: {}, pull: true)
  build_cmd = get_build_cmd(
    tag: tag,
    dir: dir,
    args: args,
    pull: pull,
  )
  system!(cmd: build_cmd)
end

startTime = Time.now

# Build base nginx container.
["nginx:#{NGINX_VERSION}", "nginx:latest"].each do |tag|
  build(
    tag: tag,
    dir: "nginx/base",
    args: {
      "NGINX_VERSION" => NGINX_VERSION
    }
  )
end

def do_php_build(dir:, php_tag:, pull: true)
  ["fpm", "cli"].each do |type|
    PHP_VERSIONS.each do |version|
      ["#{php_tag}:#{version}-#{type}", "#{php_tag}:latest-#{type}"].each do |tag|
        build(
          tag: tag,
          dir: dir,
          args: {
            "ALPINE_VERSION" => ALPINE_VERSION,
            "PHP_VERSION" => version,
            "PHP_TYPE" => type,
          },
          pull: pull
        )
      end
    end
  end
end

# Build base PHP containers.
do_php_build(
  dir: "php/base",
  php_tag: "php",
)

# Build development PHP containers.
do_php_build(
  dir: "php/dev",
  php_tag: "php-dev",
  pull: false,
)

finishTime = Time.now
diffTime = finishTime - startTime

puts "\e[1;32m[#{get_timestamp}] All builds complete in #{diffTime.to_s} secs!\e[0m"

# Build rsyslog container.
["rsyslog:#{RSYSLOG_VERSION}", "rsyslog:latest"].each do |tag|
  build(
    tag: tag,
    dir: "rsyslog",
    args: {
      "ALPINE_VERSION" => ALPINE_VERSION,
      "RSYSLOG_VERSION" => RSYSLOG_VERSION,
    }
  )
end

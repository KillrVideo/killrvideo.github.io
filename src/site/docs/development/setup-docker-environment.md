# Setting up the Docker Environment

KillrVideo uses Docker for running all our dependencies on other projects and infrastructure.
The [killrvideo-docker-common][docker-common] project that you added as a Git Subtree in the
[previous step][previous] contains some of the common setup that you'll need. Remember that
you're not only going to be setting up Docker for yourself here, but you're also setting up
a process for KillrVideo users who want to try your microservices code.

We've chosen to use the [Docker Compose][docker-compose] for defining and spinning up our
dependencies. This tool is nice because it allows us to define all our infrastructure in a
`.yaml` file and then it takes care of pulling the required images and spinning up the
instances. If you haven't yet, you can get a high level overview of how we use Docker in our
[Docker guide][docker-guide] documentation.

## Generate the Environment File

The first thing you need to do is create a Docker Compose [Environment file][env-file] at the
root of your project. This file, named `.env`, simply contains key-value pairs of environment
variables with information about your local Docker setup that KillrVideo needs in order to 
run. The [killrvideo-docker-common][docker-common] project contains shell scripts that can
generate the bulk of this file for you.

So for example in Windows, I can use a Powershell command prompt to run:

```
PS> .\lib\killrvideo-docker-common\create-environment.ps1
```

Or on a Mac/Linux, I can run:

```
> ./lib/killrvideo-docker-common/create-environment.sh
```

You should end up with a file that looks something like this:

```bash
COMPOSE_PROJECT_NAME=killrvideo
COMPOSE_FILE=.\lib\killrvideo-docker-common\docker-compose.yaml;.\docker-compose.yaml
KILLRVIDEO_DOCKER_TOOLBOX=false
KILLRVIDEO_HOST_IP=10.0.75.1
KILLRVIDEO_DOCKER_IP=10.0.75.2
```

You should make sure that the `.env` file is added to the `.gitignore` for the repo since 
it's contents will vary from system to system depending on that user's Docker setup. The IP
addresses contained in the file are the ones we'll use to communicate between the components
running in Docker (i.e. DataStax Enterprise, the Web UI, etc.) and the ones running on a
local development machine (i.e. the microservices code you're writing).

## Creating the Docker Compose YAML

You'll notice that the `.env` file that you generated has a key called `COMPOSE_FILE` and
that it points to two `docker-compose.yaml` files. These YAML files are where we define the
services we want Docker to run for us. One of those files is included in the [killrvideo-docker-common][docker-common]
project and it contains all the basic services that KillrVideo projects need. If you open it,
you'll see it contains definitions for spinning up:
- **DataStax Enterprise**: The microservices you're writing will interact with this node to store
data and provide the functionality of the site.
- **[etcd][etcd]**: This key-value store is used as our service registry (i.e. so that the
various applications and services know what IP addresses to use to talk to other services)
- **[Registrator][registrator]**: An application that listens to the internal Docker API for
containers starting and stopping, and registers them with our service registry (i.e. etcd).

The second `docker-compose.yaml` file you will create in the root of your project (right next
to the `.env` file that you generated). This file will contain some additional dependencies
that your microservices implementation will need, including the [KillrVideo Web UI][killrvideo-web]
and the [KillrVideo Sample Data Generator][killrvideo-generator] application.

Typically, that file will look something like this:

```yaml
version: '2'

# Other services are specified in .\lib\killrvideo-docker-common\docker-compose.yaml
services:
  # Start the KillrVideo web UI on port 3000
  web:
    image: killrvideo/killrvideo-web:1.2.0
    ports:
    - "3000:3000"
    depends_on:
    - dse
    - etcd
    environment:
      SERVICE_3000_NAME: web
      KILLRVIDEO_ETCD: "etcd:2379"

  # The sample data generator
  generator:
    image: killrvideo/killrvideo-generator:1.2.1
    depends_on:
    - dse
    - etcd
    environment:
      KILLRVIDEO_ETCD: "etcd:2379"
```

The tags (i.e. version numbers) you use for the images may be different as newer versions of 
those applications are developed and released to the [KillrVideo Docker Hub][docker-hub].
This file should be checked-in to Git since developers who are trying out your code will want
to run those same dependencies.

## Running with Docker Compose

Once you have the `.env` and the `docker-compose.yaml` files in place, you can now use the
`docker-compose` command line tool to manage those dependencies. For example, to start all of
them up, do:

```
> docker-compose up -d
```

The `-d` switch just tells Docker Compose to run the containers in the background. While the
containers are running, you can see their log output by doing:

```
> docker-compose logs SERVICE_KEY
```

Where the `SERVICE_KEY` is the name of the service node from the `docker-compose.yaml`
files. For example, to view the DSE node's logs, you can run:

```
> docker-compose logs dse
```

The `docker-compose` command line tool has commands for doing things like starting or
restarting a service container, stopping a service container, or even tearing down a service
container completely (effectively erasing any data, for example, in DSE).

## Provide an Easy Path for Developers

Since you're building reference code that's going to be used by other developers looking to
learn, you'll also want to provide an easy way for them to setup their Docker environment and
start up the necessary dependencies when they clone your repo and want to try it out. Since
that "easy path" may be different depending on the programming language you're writing an
implementation for, we won't tell you specifically what that should look like. It could be,
for example, some orchestration that happens as part of your project's initial build. Or it
could be a separate script that a developer is told to run in your project's documentation.

For example, in the [C# Implementation][killrvideo-csharp] we've included a `setup-docker.bat`
file in the root of the project that runs the [killrvideo-docker-common][docker-common]
Powershell script to create the `.env` file for the user and then runs a `docker-compose pull`
to download all the Docker images. In the [Getting Started][getting-started-csharp] docs, we
tell the user to run that `.bat` file, followed by running `docker-compose up -d` to start
the environment before running the C\# code. 


[docker-common]: https://github.com/KillrVideo/killrvideo-docker-common
[previous]: /docs/development/setup-git-repo/
[docker-compose]: https://docs.docker.com/compose/overview/
[docker-guide]: /docs/guides/docker/
[env-file]: https://docs.docker.com/compose/env-file/
[etcd]: https://github.com/coreos/etcd
[registrator]: https://github.com/gliderlabs/registrator
[killrvideo-web]: https://github.com/KillrVideo/killrvideo-web
[killrvideo-generator]: https://github.com/KillrVideo/killrvideo-generator
[docker-hub]: https://hub.docker.com/u/killrvideo/
[killrvideo-csharp]: https://github.com/LukeTillman/killrvideo-csharp
[getting-started-csharp]: /docs/languages/c-sharp/
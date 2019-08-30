# Setting up the Docker Environment

KillrVideo uses Docker for running all our dependencies on other projects and infrastructure.
We've chosen to use the [Docker Compose][docker-compose] for defining and spinning up our
dependencies. This tool is nice because it allows us to define all our infrastructure in a
`.yaml` file and then it takes care of pulling the required images and spinning up the
instances. If you haven't yet, you can get a high level overview of how we use Docker in our
[Docker guide][docker-guide] documentation.

To create the Docker Compose configuration for a new service implementation, the simplest approach
is to copy the `docker-compose.yaml` file from one of the other service implementations as a 
starting point. You may also want to reference the [killrvideo-docker-common][docker-common] 
project to make sure that your configuration is up to date in terms of the required components
and versions. At a minimum you will need to start a DSE node and the web application.

The `docker-compose.yaml` you create  should be checked-in to Git. Remember that you're not 
only going to be setting up Docker for yourself here, but you're also setting up a process for 
KillrVideo users who want to try your microservices code. Developers who are trying out your 
code will want to run those same dependencies.


## Building a Docker Container

It will be helpful to package your services in a Docker image in order to run them as part of 
the KillrVideo application and specify the implementation as the `backend` service in your
`docker-compose.yaml` file.

To do this you will need to provide a `Dockerfile` that describes the instructions for building
your image. You'll want to start with a base image that is appropriate for the language that 
your services are implemented in. See these [Dockerfile best practices][dockerfile-best-practices]
for more information.

In order to build your image using the dockerfile, you'll use a command such as this:

```
> docker build -t <organization>/<repo>:<version>
```

Where `organization` is your organization (i.e. "killrvideo"), `repo` is the name of the implementation
(i.e. "killrvideo-java", and `version` is the version number you wish to apply to the image.
[Semantic versioning][semver] is recommended, i.e. "3.0.1", "3.0.1-rc1", etc. We recommend using Git
tags to convey the version number as part of pull request rather than hardcoding the version in files.

It's also helpful to release the images you build to the [KillrVideo Docker Hub][docker-hub].
The service implementations provided under the KillrVideo project use [Travis CI][travis-ci]
to perform automated builds of Docker images and push these images to Docker Hub. To emulate this,
it will be helpful to look at the `.travis.yml` file from one of the other service implementations.

## Running with Docker Compose

Once you have the `docker-compose.yaml` file in place and have built an image using `docker build`,
you can now use the `docker-compose` command line tool to run your application. For example, 
to start all of them up, do:

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

For example, the [Node.js implementation][killrvideo-nodejs] and [Python implementation][killrvideo-python]
each include files listing dependencies - the required libraries which need to be downloaded
in order to run the services in each language.


[docker-common]: https://github.com/KillrVideo/killrvideo-docker-common
[previous]: /docs/development/setup-git-repo/
[docker-compose]: https://docs.docker.com/compose/overview/
[docker-guide]: /docs/guides/docker/
[docker-hub]: https://hub.docker.com/u/killrvideo/
[killrvideo-nodejs]: https://github.com/KillrVideo/killrvideo-nodejs
[killrvideo-python]: https://github.com/KillrVideo/killrvideo-python
[dockerfile-best-practices]: https://docs.docker.com/develop/develop-images/dockerfile_best-practices/
[semver]: https://semver.org
[travis-ci]: https://travis-ci.org/

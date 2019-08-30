# Repositories Overview

The KillrVideo application consists of multiple repositories which implement the various architecture 
layers (see the [architecture][architecture] page for a review of the layers).

## Web Tier Repositories

- The Web Client and Web Server code is implemented in the [killrvideo-web][killrvideo-web] repository.

## Microservices Tier Repositories

There are multiple implementations of the KillrVideo microservices tier in various languages:

- The [Java implementation][java] is found in the [killrvideo-java][killrvideo-java] repository.
- The [Node.js implementation][nodejs] is found in the [killrvideo-nodejs][killrvideo-nodejs] repository.
- The [C# implementation][c-sharp] is found in the [killrvideo-csharp][killrvideo-csharp] repository.
- The [Python implementation][python] is found in the [killrvideo-python][killrvideo-python] repository.

These repositories contain `Dockerfile` definitions to build Docker images for the various service 
implementations for the KillrVideo application. These repos are linked to [Travis CI][travis], which builds the 
Docker images and publishes them to [DockerHub][DockerHub]. 

Each of these implementations has dependencies on the following common repository which is implemented as a
[Git subtree][git-subtree]:

- The [killrvideo-service-protos][killrvideo-service-protos] contains the [gRPC][grpc] service definitions. 


The [killrvideo-generator][killrvideo-generator] repository contains a test data [generator][generator] which exercises
the microservices to insert data into the KillrVideo database. This repository has the same dependencies as the 
various microservice tier implementations. This would only require changes in cases where there are changes to the 
[killrvideo-service-protos][killrvideo-service-protos].

## Data Tier Repositories

- The [killrvideo-data][killrvideo-data] repository defines schema used by the KillrVideo application, including CQL for 
Cassandra tables, DSE Search schema, and Graph schema.
- The [killrvideo-cdm][killrvideo-cdm] repository contains a sample data set for the [Cassandra Dataset Manager][cdm]
which can be used with the KillrVideo application.

## Infrastructure Repositories

The following repositories are used to build up infrastructure elements such as Docker images
which are used in the deployed KillrVideo application. 

- The [killrvideo-all-in-one][killrvideo-all-in-one] repository provides the simplest possible configuration for 
starting the KillrVideo application in Docker on your desktop.

- The [killrvideo-docker-common][killrvideo-docker-common] repository provides composable set of Docker Compose 
scripts for running KillrVideo in various configurations useful for development and testing, including adding
[OpsCenter][opscenter], metrics collection, security, and swapping between the various microservice tier 
implementations.

- The [killrvideo-dse-config][killrvideo-dse-config] provides scripts for loading the schema defined in 
[killrvideo-data][killrvideo-data] into a DataStax Enterprise node running in Docker, or a remote cluster, as
described in [Setting up the Docker Environment][setup-docker-environment]

 
 ## Documentation Repositories
 
- The [killrvideo.github.io][killrvideo.github.io] repository creates this documentation site.  


[architecture]: /docs/guides/architecture
[killrvideo-web]: https://github.com/KillrVideo/killrvideo-web
[killrvideo-java]: https://github.com/KillrVideo/killrvideo-java
[killrvideo-nodejs]: https://github.com/KillrVideo/killrvideo-nodejs
[killrvideo-csharp]: https://github.com/KillrVideo/killrvideo-csharp
[killrvideo-python]: https://github.com/KillrVideo/killrvideo-python
[git-subtree]: https://www.atlassian.com/blog/git/alternatives-to-git-submodule-git-subtree
[killrvideo-data]: https://github.com/KillrVideo/killrvideo-data
[killrvideo-service-protos]: https://github.com/KillrVideo/killrvideo-service-protos
[killrvideo-docker-common]: https://github.com/KillrVideo/killrvideo-docker-common
[killrvideo-all-in-one]: https://github.com/KillrVideo/killrvideo-all-in-one
[killrvideo-cdm]: https://github.com/KillrVideo/killrvideo-cdm
[killrvideo-generator]: https://github.com/KillrVideo/killrvideo-generator
[killrvideo.github.io]: https://github.com/KillrVideo/killrvideo.github.io
[travis]: https://travis-ci.org/KillrVideo
[DockerHub]: https://hub.docker.com/
[cdm]: http://cdm.readthedocs.io/en/latest/
[grpc]: http://www.grpc.io/
[killrvideo-dse-config]: https://github.com/KillrVideo/killrvideo-dse-config
[setup-docker-environment]: /docs/development/setup-docker-environment/
[c-sharp]: /docs/languages/c-sharp/
[nodejs]: /docs/languages/nodejs/
[java]: /docs/languages/java/
[python]: /docs/languages/python/
[generator]: /docs/development/generating-sample-data/
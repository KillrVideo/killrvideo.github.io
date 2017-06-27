# Repositories Overview

The KillrVideo application consists of multiple repositories which implement the various architecture 
layers (see the [architecture][architecture] page for a review of the layers).

## Web Tier Repositories

- The Web Client and Web Server code is implemented in the [killrvideo-web][killrvideo-web] repository.

## Microservices Tier Repositories

There are multiple implementations of the KillrVideo microservices tier in various languages:

- The Java implementation is found in the [killrvideo-java][killrvideo-java] repository.
- The Node.js implementation is found in the [killrvideo-nodejs][killrvideo-nodejs] repository.
- The C# implementation is found in Luke Tillman's [killrvideo-csharp][killrvideo-csharp] repository.

Each of these implementations has dependencies on the following common repositories which are implemented as 
[Git subtree][git-subtree]:

- The [killrvideo-docker-common][killrvideo-docker-common] contains a Docker compose file that describes how to spin
up common infrastructure elements required by the microservices tier, including DataStax Enterprise and [etcd][etcd].
- The [killrvideo-service-protos][killrvideo-service-protos] contains the [gRPC][grpc] service definitions. 

The [killrvideo-generator][killrvideo-generator] repository contains a test data generator which exercises
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


- The [killrvideo-dse-docker][killrvideo-dse-docker] and [killrvideo-studio-docker][killrvideo-studio-docker]
repositories contain scripts to build Docker images for DataStax Enterprise and DataStax Studio 
specifically initialized for the KillrVideo application. These repos are linked to [Travis CI][travis], which builds the 
Docker images and publishes them to [DockerHub][DockerHub]. 

- The [killrvideo-dse-external][killrvideo-dse-external] repository provides Docker compose configuration for running 
Killrvideo with an external cluster.

 
 ## Documentation Repositories
 
- The [killrvideo.github.io][killrvideo.github.io] repository creates this documentation site.  



[architecture]: /docs/guides/architecture
[killrvideo-web]: https://github.com/KillrVideo/killrvideo-web
[killrvideo-java]: https://github.com/KillrVideo/killrvideo-java
[killrvideo-nodejs]: https://github.com/KillrVideo/killrvideo-nodejs
[killrvideo-csharp]: https://github.com/LukeTillman/killrvideo-csharp
[git-subtree]: https://www.atlassian.com/blog/git/alternatives-to-git-submodule-git-subtree
[killrvideo-data]: https://github.com/KillrVideo/killrvideo-data
[killrvideo-service-protos]: https://github.com/KillrVideo/killrvideo-service-protos
[killrvideo-docker-common]: https://github.com/KillrVideo/killrvideo-docker-common
[killrvideo-cdm]: https://github.com/KillrVideo/killrvideo-cdm
[killrvideo-generator]: https://github.com/KillrVideo/killrvideo-generator
[killrvideo.github.io]: https://github.com/KillrVideo/killrvideo.github.io
[travis]: https://travis-ci.org/KillrVideo
[DockerHub]: https://hub.docker.com/
[cdm]: http://cdm.readthedocs.io/en/latest/
[grpc]: http://www.grpc.io/
[killrvideo-dse-external]: https://github.com/KillrVideo/killrvideo-dse-external
[killrvideo-dse-docker]: https://github.com/KillrVideo/killrvideo-dse-docker
[killrvideo-studio-docker]: https://github.com/KillrVideo/killrvideo-studio-docker
# Docker and Infrastructure Dependencies

In KillrVideo, we offer microservice implementations in multiple programming languages, but
each of these implementations have a base common set of dependencies they need in order
to be a functional reference application. Those base dependencies are:

- [**DataStax Enterprise**][dse]: we need at least one node of DSE / Cassandra running that
the microservices implementations can use to store data. 
- [**KillrVideo Web Tier**][killrvideo-web]: we need the Web Tier in order to provide a
working UI and application that drives calls to the microservices.


For a developer looking to learn about Cassandra and DSE it would be impractical (and kind
of ridiculous) to ask them to install all of these things locally in addition to the code
for the microservices implementation they are interested in. Instead, we've chosen to use
[Docker][docker] to run these dependencies. Docker has become an increasingly popular way
for developers to run infrastructure on their local dev machines. This way, the only thing a
developer needs to install is Docker for Mac or Windows in order to try out KillrVideo (and 
chances are they may already have it installed).

## Docker Compose for Starting Dependencies

The [Docker][docker] project offers a nice tool called [Docker Compose][compose] which
allows you to run multiple Docker containers that are defined in a `.yaml` file. 

For a very simple way to get the application running using Docker Compose, see the 
[Getting Started][getting-started] page.

We created the [killrvideo-docker-common][docker-common] repository to house a flexible 
configuration that can be used to swap between the various microservice tier implementations and 
enable additional configurations.

To accomplish this flexible configuration, we take advantage of a feature of Docker Compose 
that lets us define additional `.yaml` files that we layer on top of the base
`docker-compose.yaml` file and provide overrides and additions.


### Other Docker Compose Examples

You may be interested in other configuration options for running KillrVideo in Docker, such as:
 
- Starting a copy of [OpsCenter][ops-center], the web-based visual management and monitoring tool,
to monitor your KillrVideo DSE node(s).
- Starting a copy of [Studio][studio], an interactive web-based developer tool for interacting
with Cassandra data using CQL and Graph data using Gremlin.
- Storing DSE / Cassandra data on a volume mounted from the host machine, so that your data
can survive beyond the lifespan of a single container.

These alternate configurations are available as part of the [killrvideo-docker-common][docker-common] 
repository. See the `README.md` file for a detailed description of how to use these configurations; we
provide a quick summary here.

To use one of these alternate configurations, you'll want to concatenate additional `.yaml` files
when calling `docker-compose`, for example:

```
> docker-compose -f docker-compose.yaml -f docker-compose-volumes.yaml up -d
```

Alternatively, you can create a `.env` file in the directory where you want to run `docker-compose` and
provide a value for the `COMPOSE_FILE` variable:

For example, you might change the default configuration to: 

```
COMPOSE_FILE=./docker-compose.yaml:./docker-compose-volumes.yaml:
```

in order to use the `docker-compose-volumes.yaml` file which starts a DSE instance 
with the data drive mounted from the host machine.


## Running KillrVideo with an external DSE cluster

While the default configuration we provide for running KillrVideo in Docker includes running a single
DSE node in a docker container, it is also possible to configure KillrVideo to run against an external cluster
(that is, a cluster not running in Docker). We use this configuration option to run the publicly accessible
version of KillrVideo you can find at [www.killrvideo.com][website].

To configure KillrVideo to run with an external cluster, you'll want to take a look at the configuration options
supported by the [killrvideo-dse-config] container. You'll want to edit the `docker-compose` configuration so that
DSE is not started in a docker container, and you'll want to edit the environment variables in your local `.env` file
in the directory where you run `docker-compose` to configure:
 
- any desired security roles that you have set in the cluster for administrative and application roles
- replication strategies to use for Cassandra and Graph data

See the [Service Discovery][service-discovery] page for more information. for more information on the environment 
variables you can set in order to configure these options.

[Next: Service Discovery][next]


[next]: /docs/guides/service-discovery/
[dse]: http://www.datastax.com/products/datastax-enterprise
[killrvideo-web]: https://github.com/killrvideo/killrvideo-web
[docker]: https://www.docker.com/
[compose]: https://docs.docker.com/compose/overview/
[docker-common]: https://github.com/KillrVideo/killrvideo-docker-common
[studio]: https://www.datastax.com/products/datastax-studio-and-development-tools
[ops-center]: https://www.datastax.com/products/datastax-opscenter
[website]: http://www.killrvideo.com
[killrvideo-dse-config]: https://github.com/killrvideo/killrvideo-dse-config
[getting-started]: /docs/getting-started/
[service-discovery]: /docs/guides/service-discovery/
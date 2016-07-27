# Service Discovery with etcd

One problem all microservices architectures face is how to do service discovery. How does
the Video Catalog service know where to go to talk to Cassandra? How does the Web Tier know
where to talk to the Video Catalog service? There are really two parts to the common way of 
solving this problem:

1. Service Registration: We need a well-known location and some mechanism to register the
location of services.
1. Service Discovery: We need some way to query the location of services.

In KillrVideo, we decided to use [etcd][etcd] as our service registry. At its most basic, 
etcd is just a distributed, consistent, key-value store. The [v2 API][v2] which we currently
use to interact with etcd is just simple curlable HTTP API (funny enough, the [v3 API](https://github.com/coreos/etcd/blob/master/Documentation/dev-guide/api_reference_v3.md)
for etcd is all based on Protocol Buffers and Grpc just like KillrVideo).

As mentioned in the [previous section on Docker][prev], we use a program called 
[Registrator][registrator] to take care of automatically registering our services running in
containers with etcd. This means that our DataStax Enterprise node, for example, will
automatically be registered with etcd whenever its container is started.

## Querying etcd

All KillrVideo data is stored under `/killrvideo` in etcd. This means that the base URL for
queries to the v2 API in [etcd][etcd] is:

```
http://${SOME_IP_ADDRESS}:2379/v2/keys/killrvideo

```
For service registrations, we put that data under `/services/${SERVICE_NAME}`. So, for
example, when trying to find the location of the *cassandra* service we'd make a `GET` 
request to:

``` 
http://${SOME_IP_ADDRESS}:2379/v2/keys/killrvideo/services/cassandra
```

For more details on the response returned from this call, check out the [v2 API documentation][v2].

## Registering services in etcd

While [Registrator][registrator] takes care of registering the things running in containers
for us, what about the microservice code running on a local developer machine? The Web Tier,
for example, is going to need to know where to call the various microservices. For the
microservice implementations, we leave service registration with [etcd][etcd] up to each
implementation's code. This isn't terribly complicated code though. Usually it just means
that when the microservices start, they make a `PUT` request to the same URL we would use to
lookup a service with the IP address they're listening on. For example, the Video Catalog 
service would use:

```
http://${SOME_IP_ADDRESS}:2379/v2/keys/killrvideo/services/VideoCatalogService
```

> #### Note on Grpc Service Naming Conventions
> All of the services defined in Protocol Buffers for use with Grpc use the service's "short
> name" when registering with etcd. The short name for a service is the same name used in
> `.proto` file and **excludes the namespace**.

Again, for more details on the exact API request and response, see the [v2 API documentation][v2].

[etcd]: https://github.com/coreos/etcd
[v2]: https://github.com/coreos/etcd/blob/master/Documentation/v2/README.md
[registrator]: http://gliderlabs.com/registrator/latest/
[prev]: /docs/guides/docker/
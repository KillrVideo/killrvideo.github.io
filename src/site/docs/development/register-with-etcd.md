# Registering Services with etcd

TODO: this should probably be removed

You already know from the [Connecting to DataStax Enterprise][connect-to-dse] section that
KillrVideo uses [etcd][etcd] for service discovery. While [Registrator][registrator] takes
care of registering our infrastructure services (running in Docker) with etcd so they can be 
discovered, it's up to us to register *our services* (running outside Docker on a local
development machine) with etcd. If we didn't do this, the Web Tier that runs in Docker would
have no way of knowing how to contact and call methods on our gRPC services.

## A Quick Recap of the etcd Setup

Just a quick recap of our etcd setup from the [Connecting to DataStax Enterprise][connect-to-dse]
section:

- Etcd is available in Docker at the `KILLRVIDEO_DOCKER_IP` from our Docker `.env` file and is
listening on port `2379` by default.
- Our infrastructure services are registered by Registrator at keys under 
`/killrvideo/services` by default.
- We can use any client that supports making HTTP requests to interact with etcd, but its
more likely we're using a client library with a nicer API written in our programming language
instead. Remember to configure the client to use the [v2 API][etcd-v2-api].

We need to register our gRPC microservice implementations running locally in a way that's
consistent with how Registrator is registering our infrastructure services.

## Listen vs Broadcast Addresses

The first thing we need to figure out is what IP address and port should we use when we 
register our gRPC services with etcd. When we create our gRPC server and then bind multiple
services to it (so they run together in process), we have to tell the gRPC server what IP and
port to listen on for connections. The strategy we've taken in other programming language
implementations is to have two configurations available for IP addresses:

- **Listen Address**: The IP and port to tell the gRPC server to bind to and listen on. This 
is set to IP `0.0.0.0` and port `50101` by default, which tells gRPC to listen on *all 
available IP addresses* on port `50101`.
- **Broadcast Address**: The IP and port to tell other services to use when contacting us.
This is the IP address we'll actually register with etcd and can be set to the value of the
`KILLRVIDEO_HOST_IP` variable from our Docker `.env` file and port `50101` by default.  

This is the same kind of configuration that Cassandra allows you to set in the `cassandra.yaml`
file (e.g. separate `rpc_address` and `broadcast_rpc_address` settings).

## Using the gRPC Service Name to Register in etcd

Now that we have the broadcast address to register with etcd, we need to figure out the key to
register each service under. To calculate this, we can use the following components:

- The gRPC service's **short name**. That is, the name of the service from its Protocol Buffer
definition without the namespace. For example, `killrvideo.video_catalog.VideoCatalogService`
has a short name of just `VideoCatalogService`. Your programming language's library for gRPC
and Protocol Buffers probably has a way to access this name on the generated class code.
- A **unique identifier** for the application instance that's running the service. For example
in the C\# project, we use the unique identifier `killrvideo-csharp-1` for the first instance 
of the C\# app running. The instance number (i.e. `1` in that example) is configurable.

We need that unique identifier to account for multiple instances of a service running in an
environment, even though for our developers, there will only be one. Putting it all together
we get a **key** that looks like this:

```
/killrvideo/services/${SERVICE_SHORT_NAME}/${APP_UNIQUE_ID}
```

And the **value** for that key is the broadcast address where our services can be contacted.

## Register on Startup, Remove on Shutdown

On startup, you'll want to use the strategy above for registering each gRPC service with etcd.
You should also try and provide a way to gracefully shutdown your services (for example, by 
telling the user in the console to "Press Crtl + C to exit"). Then when gracefully shutting
down, your application should remove each service from etcd before stopping.


[connect-to-dse]: /docs/development/connecting-to-datastax-enterprise/
[etcd]: https://github.com/coreos/etcd
[etcd-v2-api]: https://github.com/coreos/etcd/blob/master/Documentation/v2/api.md
[registrator]: https://github.com/gliderlabs/registrator
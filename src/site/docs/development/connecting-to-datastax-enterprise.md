# Connecting to DataStax Enterprise

These microservices are part of a reference application for Cassandra and DSE, so you'll 
obviously be connecting to a DSE node. You should already have your Docker environment setup
and running after completeing the [Setup Docker Environment][docker-setup] step. Part of that
environment includes a running DSE node. So how do you get the IP address and port that you
need to connect?

## Understanding Registrator

This is where our service discovery via [etcd][etcd] comes in. Part of the Docker environment
you created also contains one node of etcd, as well as a container running [Registrator][registrator].
Registrator will automatically register any containers that startup in the Docker environment 
with the node of etcd (so that you can discover where they are running). So how does
Registrator know what service name to use when registering a service with etcd? Let's take a
look at a part of the `docker-compose.yaml` where our DSE service is defined:

```yaml
  # ... other services snipped ...

  # DataStax Enterprise
  dse:
    image: killrvideo/killrvideo-dse:1.0.0
    ports:
    - "9042:9042"
    - "8983:8983"
    cap_add:
    - IPC_LOCK
    ulimits:
      memlock: -1
    environment:
      SERVICE_9042_NAME: cassandra
      SERVICE_8983_NAME: dse-search
```

The environment variable `SERVICE_9042_NAME` is defined in that `.yaml` to tell Registrator
to register the service listening on port `9042` (the default port for executing CQL in
Cassandra) as the `cassandra` service. If we had not explicitly set the service name via that
environment variable, Registrator would have used its [default behavior][registrator-service-names]
for service names when naming the service and registering it with etcd. The same is true for
the `dse-search` service running on port `8983`.

Registrator is configured to register all containers in etcd as keys under `/killrvideo/services`.
You'll want to keep that in mind when querying for service locations as described below.

## Connecting to etcd

Now that we know we can get the host and port for our DSE node by looking up the `cassandra`
service in etcd, how do we connect to etcd itself? This is where our `.env` file that was
written as part of the Docker setup comes in handy. That file contains the IP addresses of
both your Host (i.e. dev laptop) and Docker where containers are running. Our microservices 
code can read the environment values from the `.env` file and use the `KILLRVIDEO_DOCKER_IP` 
variable as the IP address to talk to etcd. By default, etcd listens on port `2379`.

## Querying etcd to Find Services

The [v2 API of etcd][etcd-v2-api] is exposed via simple HTTP endpoints, so we can use any
client capable of making HTTP requests to query etcd. For example, we can get the location of
the `cassandra` service by doing a `GET` request to:

```
http://${ETCD_IP_ADDRESS}:2379/v2/keys/killrvideo/services/cassandra
```

You could, of course, similarly lookup the `dse-search` service by doing a `GET` request to:

```
http://${ETCD_IP_ADDRESS}:2379/v2/keys/killrvideo/services/dse-search
```

Many programming languages also offer specific etcd client libraries that provide a nicer
interface for doing operations against etcd. You may want to investigate using something like
that instead of doing manual HTTP requests. Just remember if using a client library that
you're doing operations against a v2 node, so configure your client accordingly. 

## Making sure DSE is Ready

Once we have the IP address and port for the `cassandra` service, we can then go about
configuring the driver to connect to our DSE cluster (i.e. a single node running in Docker).
One thing to keep in mind when writing the code that sets up and initially connects to the
cluster is that DSE takes time to start up when it's launched. This is especially true for a
brand new node that is starting for the first time.

So, when writing the code that initially connects to DSE, be sure to add some retry logic
that retries the intial connection. In other microservice implementations, we've found that
**90-120 seconds** is usually enough time for it to start, so we built in retries for up to
that time period before exiting with an error.

## The CQL Schema and Solr Configuration

The [DSE Docker image][killrvideo-dse] defined in the common `docker-compose.yaml` file that
we looked at above contains code that will bootstrap the CQL schema and Solr configuration 
for you the first time it's started. Since both ports `9042` and `8983` are exposed, it's 
possible to connect to DSE from your laptop if you want. For example, you could use DevCenter
or `cqlsh` to connect and explore the CQL schema. Or you could access the Solr Admin UI 
(included in DSE search) to take a look at the Solr resources that were created.


[docker-setup]: /docs/development/setup-docker-environment/
[etcd]: https://github.com/coreos/etcd
[etcd-v2-api]: https://github.com/coreos/etcd/blob/master/Documentation/v2/api.md
[registrator]: https://github.com/gliderlabs/registrator
[registrator-service-names]: http://gliderlabs.com/registrator/latest/user/services/#service-name
[killrvideo-dse]: https://github.com/KillrVideo/killrvideo-dse-docker
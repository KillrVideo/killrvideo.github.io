# Connecting to DataStax Enterprise


These microservices are part of a reference application for Cassandra and DSE, so you'll 
obviously be connecting to a DSE cluster. You should already have your Docker environment setup
and running after completeing the [Setup Docker Environment][docker-setup] step. Part of that
environment includes a running DSE node. So how do you get the IP address and port that you
need to connect?

## Locating DSE

The default Docker configuration for KillrVideo uses a `docker-compose` file to start the application,
including one DSE node. Within the Docker network, this node can be referenced by the service name in the 
`docker-compose.yaml` file which is `dse`. 
 
We provide alternate configurations that allow the contact points to be overriden by setting the 
`KILLRVIDEO_DSE_CONTACT_POINTS` environment variable. This makes it simple to connect KillrVideo to an external
 cluster. See the [Docker Setup][docker-setup] page for more information. 

We recommend defaulting the contact points to `dse` but checking the environment variable and using that 
value if set.

## Making sure DSE is Ready

Once we have the contact point(s) for our cluster, we can then go about
configuring the driver to connect to our DSE cluster (i.e. a single node running in Docker).
One thing to keep in mind when writing the code that sets up and initially connects to the
cluster is that DSE takes time to start up when it's launched. This is especially true for a
brand new node that is starting for the first time.

So, when writing the code that initially connects to DSE, be sure to add some retry logic
that retries the intial connection. In other microservice implementations, we've found that
**90-120 seconds** is usually enough time for it to start, so we built in retries for at least
that amount of time before exiting with an error.

## The CQL, Search and Graph Schema Configuration

The [Killrvideo DSE configuration][killrvideo-dse-config] defined in the common `docker-compose.yaml` file that
we looked at above contains code that will bootstrap the schema used by the KillrVideo application including 
CQL tables as well as search indexes and graph schema where available.

[docker-setup]: /docs/development/setup-docker-environment/
[killrvideo-dse-config]: https://github.com/KillrVideo/killrvideo-dse-config
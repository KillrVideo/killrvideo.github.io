# Service Discovery 

One problem all microservices architectures face is how to do service discovery. How does
the Video Catalog service know where to go to talk to Cassandra? How does the Web Tier know
where to talk to the Video Catalog service? There are really two parts to the common way of 
solving this problem:

1. Service Registration: We need a well-known location and some mechanism to register the
location of services.
1. Service Discovery: We need some way to query the location of services.

In KillrVideo, we've used a simplified approach for these functions, relying on two approaches.

1. Since the components of KillrVideo are primarily deployed in Docker, the primary approach used is to
use the service aliases defined in the `docker-compose` files: `dse` for DataStax Enterprise, `backend` for the
microservice implementation, `generator` for the KillrVideo Data Generator, `web` for the KillrVideo Web Application,
`kafka` for the Kafka broker, and so on.

1. In certain configurations, we may be running components outside of Docker, in which case the aliases are not 
available. For example, we might be running the backend services in our IDE, or leveraging a database cluster
running in DataStax Constellation. To account for these cases, we use the environment variables that, when set,
should be used to override the aliases:

    - `KILLRVIDEO_DSE_CONTACT_POINTS` - comma separated list of hostnames or IP addresses that represent contact points 
    for the cluster. Default value is `dse`.
    - `KILLRVIDEO_KAFKA_BOOTSTRAP_SERVERS` - comma separated list of hostnames or IP addresses that represent bootstrap
    servers for the Kafka cluster. Default value is `kafka`.
    - `KILLRVIDEO_BACKEND` - hostnames or IP addresses that represent the location of the backend GRPC services 
    Default value is `backend`.

Next, let's take a look at how we can use DataStax Studio to examine and analyze the data
in our KillrVideo instance.

[Next: Using DataStax Studio][next]

[prev]: /docs/guides/docker/
[next]: /docs/guides/datastax-studio/
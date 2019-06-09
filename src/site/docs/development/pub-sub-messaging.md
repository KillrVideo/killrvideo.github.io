# Adding Pub-Sub Messaging

KillrVideo is architected to use [events for service collaboration][fowler-events]. This
means that the services publish events about interesting things that happen (i.e. when state
changes occur) and other services are free to subscribe to those events and react. As a
result, you'll need to setup some kind of messaging infrastructure that supports pub-sub.
We've defined the events published by each service in Protocol Buffers files that are located
next to each service's definition in the [killrvideo-service-protos][service-protos] project
that you used when [Geneterating Service Code][generate-service-code].

## Implementation Recommendations

Since this is a reference application and all the gRPC service implementations will be running
in-process together so users can debug them, the simplest way to do pub-sub messaging is via
some in-memory mechanism. Some programming languages may already have an in-memory message bus
implementation available (for example, in Java we have the [Guava EventBus][guava-event-bus] 
available). If you don't have an in-memory implementation available, it's usually pretty 
straightforward to create a simple one of your own.

Another option is to use a real piece of messaging infrastructure like Kafka or RabbitMQ.
Since KillrVideo uses Docker Compose for spinning up all the dependencies needed by a user in
their development environment, it's possible to piggyback on that and spin up a container
using messaging infrastructure of your choice. You would go about doing this by adding it to
the `docker-compose.yaml` file as another service. 

We recommend you hide the implementation details from your consumer code as much as possible
and provide a generic API for publishing and subscribing to events. That way you could switch 
the implementation out (or provide multiple available implementations as further examples) 
for real messaging infrastructure.

## What services should subscribe to what events?

As mentioned in the section on [Implementing Services][implement-services], you should be 
using the other programming language implementations as a reference. They will always contain
the latest examples of services subscribing to and reacting to events from other services. At
the time of writing, these are the events you'll want to subscribe to.

| Event Name | Published By | Subscribed To By | Purpose |
| --- | --- | --- | --- |
| `UploadedVideoAdded` | VideoCatalogService | SearchService | Allows the SearchService to update its collection of tags and videos by tag as new videos are added. |
| `YouTubeVideoAdded` | VideoCatalogService | SearchService | Allows the SearchService to update its collection of tags and videos by tag as new videos are added. |

Just because an event doesn't currently have any subscribers doesn't mean it shouldn't be
published. Make sure you refer to the event definition's `.proto` files for each service and
the other language implementations for what events to publish and when to publish them.


[fowler-events]: http://martinfowler.com/eaaDev/EventCollaboration.html
[service-protos]: https://github.com/KillrVideo/killrvideo-service-protos
[generate-service-code]: /docs/development/generate-service-code/
[guava-event-bus]: https://github.com/google/guava/wiki/EventBusExplained
[implement-services]: /docs/development/implement-services/
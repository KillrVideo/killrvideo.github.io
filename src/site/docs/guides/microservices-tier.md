# Microservice Tier Implementation

The Microservices Tier is where all the interesting code that interacts with DataStax 
Enterprise and Cassandra lives. As a reference application, one of the goals of this project
is to have microservice implementations available in most major programming languages. But 
the goal of being able to write our services in multiple languages is not one that's unique 
to this project just because it's a reference application. Many companies find themselves
with mixed technology stacks.

We wanted a way to define our service contracts in a single common format and then be able
to generate client and server code for those services in all the languages we need to
support. This meant generating code for both the client and the server that takes advantage
of type checking in [strongly typed languages](https://en.wikipedia.org/wiki/Strong_and_weak_typing)
that support it. For example, in C\# and Java we wanted classes representing our request and
response objects, as well as generated client and server code (even if they were stubs) with
method names that reflected our service definitions.

After looking at various projects like [Apache Thrift](http://thrift.apache.org/) and 
[Apache Avro](http://avro.apache.org/) we settled on using Google's relatively new [Grpc][grpc]
framework.

## Service and Event Definitions with Protocol Buffers

With [Grpc][grpc] you define your services using [Protocol Buffers][protobuf] as the 
Interface Definition Language (IDL). So, for example, if we were defining the Ratings
Service in KillrVideo, we might start with a definition like this:

```protobuf
syntax = "proto3";
package killrvideo.ratings;
import "common/common_types.proto";

// Service that manages user's ratings of videos
service RatingsService {
  // Rate a video
  rpc RateVideo(RateVideoRequest) returns (RateVideoResponse);
}

// Request for a user rating a video
message RateVideoRequest {
  killrvideo.common.Uuid video_id = 1;
  killrvideo.common.Uuid user_id = 2;
  int32 rating = 3;
}

// Response when a user rates a video
message RateVideoResponse {
}
```

You can see that we've defined both service contract (with a single method to start), as
well as the request and response objects for that method call. Following this pattern, we
created the [killrvideo-service-protos][service-protos] project to house all the service
definitions for KillrVideo. We also created all of our event definitions (which will be
published by the services) there as well. With all the `.proto` files created, it was now
possible for the microservice projects to pull in these files and use the [Protocol Buffers][protobuf]
command line compiler along with the [Grpc][grpc] plugin for that compiler to 
[generate code](http://www.grpc.io/docs/#generating-grpc-code) in any of the supported 
languages.

## Grpc Client on the Web Server

You'll remember from the last section that our Web Server is written in NodeJS and uses
[Grpc][grpc] to communicate with the various microservices. In order to make this happen, we
use the [grpc package on NPM](https://www.npmjs.com/package/grpc) to generate clients that
the Web Server can use to call the backend microservices. The NodeJS implementation for Grpc
currently doesn't generate code files (unlike for example, in C\# and Java), but instead is
able to load and parse `.proto` files and then create client objects (with the appropriate
method names from the `.proto` files) dynamically at runtime. For example:

```javascript
let rateVideoRequest = {
    video_id: { value: 'c0d0f264-11b9-4315-b325-b9f576d00572' },
    user_id: { value: '28aae113-b4f9-4180-b5ea-b25b80a58051' },
    rating: 4
};
ratingsServiceClient.rateVideo(rateVideoRequest, function(err, rateVideoResponse) {
    // ... Handle the response here ...
});
```

There are a couple things to understand about the communication that happens with Grpc:

1. Most developers who are familiar with [Protocol Buffers][protobuf] from the past will
know it as a serialization format. Grpc uses Protocol Buffers not only as the IDL, but also 
as the "on the wire" format for communication between client and server. All the 
serialization work is done automatically for you (in the generated code).
1. Grpc also comes with a default transport ([HTTP/2](https://http2.github.io/)) for 
communication between the client and the server. For most of the supported languages, this
transport is just bindings to a common C++ implementation (i.e. so NodeJS and C\# are
actually both using the same HTTP/2 transport code under the covers).

The HTTP/2 transport included in Grpc includes support not only for "Request-Response" style
communication, but also for unidirectional and bidirectional streaming communication. In 
KillrVideo, all of the communication between the Web Server and the microservices is done 
with Request-Response style calls, but this could change in the future.

## Grpc Server in Microservices

[Grpc][grpc] will generate server stubs. Depending on the language being used for the
microservice implementation, this could be code files (e.g. in C\# and Java) or dynamic
objects created at runtime (e.g. NodeJS). The service's logic can then be "plugged in"
to these stubs. This is where all the code that talks to DataStax Enterprise and Cassandra
lives (and if you're an end user, this is the code you're interested in looking at).

In a real world application, each of the microservices defined in the [killrvideo-service-protos][service-protos]
project would probably have its own Git repo and be deployed in its own process running its
own HTTP/2 endpoint. This is one area where KillrVideo, because it's meant to be a reference
application for developers, is different. In KillrVideo, the microservice implementations 
are grouped together in Git repos by programming language to make it easy for a developer to
get all the interesting code for their programming language of choice.

Since Grpc supports binding multiple service implementations to a single HTTP/2 server 
endpoint, it also means that we can run all our microservice implementations in a single
process together on a single endpoint. Again, this is different than how we'd deploy the
application in the real world. But we've chosen to do it this way because it makes the
debugging experience much easier for developers looking to learn from the code.

## Pub-Sub Messaging and Other Supporting Infrastructure

We talked in the [High Level Architecture][architecture] overview about how KillrVideo is
designed to use event collaboration as the main avenue for services reacting to interesting
events happening in other services. This means we'll need some sort of Pub-Sub messaging
infrastructure to support the events. There are a lot of choices when it comes to
messaging infrastructure and so we've left it up to the individual microservice
implementations to choose what makes sense to use given the programming language they are
using.

Since developers exploring the code locally will be running all the service implementations
in process together, it's possible to just do all the messaging using an in-process message 
bus (for example, in Java using [Guava's EventBus](https://github.com/google/guava/wiki/EventBusExplained)).
It's also possible, since we're using a Docker container to package and run the Web Tier 
that an implementation might choose to use some other external piece of infrastructure 
running in a Docker container. Again, this is left up to the individual implementation.

Next, let's take a look at how we're using Docker to run our infrastructure dependencies in
KillrVideo.

[Next: Docker and Infrastructure Dependencies][next]

[grpc]: http://www.grpc.io/
[protobuf]: https://developers.google.com/protocol-buffers/
[service-protos]: https://github.com/KillrVideo/killrvideo-service-protos
[architecture]: ./architecture.md
[next]: ./docker.md
# Microservice Implementer's Cheatsheet

So you want to contribute an implementation of the KillrVideo microservices tier? Great! This
cheatsheet can serve as a guide to help you get started down that path. If you haven't
already, we highly suggest that before you start, you make sure and read through the general
guides available in the [Documentation][docs]. Those guides will walk you through some of the
high-level architecture of KillrVideo, as well as explain some of the things you'll be 
implementing in more detail.

Once you've done that, here are some steps to get you started with the implementation.

1. [Setup the Git Repo][1]: Create a new Git repo, add the initial commit, and then pull in
the common KillrVideo project dependencies as Git subtrees.
1. [Setup Docker Environment][2]: Setup your development environment with all the other
infrastructure and projects it needs (for example, one node of DSE) using Docker Compose.
1. [Generate Service Code][3]: Use the `.proto` files to generate client and server code
stubs with the gRPC plugin for the Protobuf compiler.
1. [Connect to DataStax Enterprise][4]: Use etcd service discovery to find the DSE node's
address and connect to it.
1. [Implement the Services][5]: Write the interesting code that implements the services.
1. [Add Pub-Sub-Messaging][6]: We use events for service collaboration in KillrVideo so you're
going to need to implement some pub-sub messaging.
1. [Register Services with etcd][7]: When you (or a developer learning from your code) starts 
up the services locally, your services should register with etcd for service discovery.
1. [Use the Web Tier][8]: The web tier has the UI for KillrVideo and makes calls to your
services. You'll need to use it (and its logs) to try out your service implementations.
1. [Generate Sample Data][9]: It's a lot easier to use the UI when you have some sample data
in the system. Luckily, there's an app for that and it's probably already running.


[docs]: /docs/
[1]: /docs/development/setup-git-repo/
[2]: /docs/development/setup-docker-environment/
[3]: /docs/development/generate-service-code/
[4]: /docs/development/connecting-to-datastax-enterprise/
[5]: /docs/development/implement-services/
[6]: /docs/development/pub-sub-messaging/
[7]: /docs/development/register-with-etcd/
[8]: /docs/development/using-the-web-tier/
[9]: /docs/development/generating-sample-data/
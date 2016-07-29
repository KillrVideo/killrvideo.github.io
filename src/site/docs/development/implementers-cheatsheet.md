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
1. [Generating Service Code][2]: Use the `.proto` files to generate client and server code
stubs with the Grpc plugin for the Protobuf compiler.


[docs]: /docs/
[1]: /docs/development/setup-git-repo/
[2]: /docs/development/generating-service-code/
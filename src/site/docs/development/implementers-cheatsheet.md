# Microservice Implementer's Cheatsheet

So you want to contribute an implementation of the KillrVideo microservices tier? Great! This
cheatsheet can serve as a guide to help you get started down that path. If you haven't
already, we highly suggest that before you start, you make sure and read through the general
guides available in the [Documentation][docs]. Those guides will walk you through some of the
high-level architecture of KillrVideo, as well as explain some of the things you'll be 
implementing in more detail.

Once you've done that, here are some tips to get you started with the implementation.

## Setup the Git Repo

We're sure you can handle creating a new empty Git repository. But once you have your initial
commit with a `README.md`, `.gitignore`, etc., you'll want to pull in the common KillrVideo 
dependencies that live in other Git repositories. The repositories you'll want to pull in 
are:

- [killrvideo-service-protos][service-protos]: This is where the Grpc service definitions
that you'll be implementing are kept, defined in `.proto` files. You'll be using the
Protobufs from here to generate code.
- [killrvideo-docker-common][docker-common]: This is where common Docker setup scripts live,
including a Docker Compose `.yaml` file for the base infrastructure dependencies needed to
run KillrVideo.

In other microservice implementations, we've decided to use `git subtree` to pull in these
dependencies rather than submodules. Here's a [pretty good overview][subtree] of subtrees if
you're not familiar. Here's an example of the commands to add those subtrees to your 
repository under the `/lib` folder:

```bash
# Add killrvideo-service-protos under lib/killrvideo-service-protos
git subtree add --prefix lib/killrvideo-service-protos git@github.com:KillrVideo/killrvideo-service-protos.git master --squash

# Add killrvideo-docker-common under lib/killrvideo-docker-common
git subtree add --prefix lib/killrvideo-docker-common git@github.com:KillrVideo/killrvideo-docker-common.git master --squash
```

Later if you need to update those dependencies you can just use the same commands as above,
only doing a `git subtree pull` instead of `git subtree add`.



[docs]: /docs/
[service-protos]: https://github.com/KillrVideo/killrvideo-service-protos
[docker-common]: https://github.com/KillrVideo/killrvideo-docker-common
[subtree]: http://blogs.atlassian.com/2013/05/alternatives-to-git-submodule-git-subtree/
# Getting Started with KillrVideo

So you're ready to dig into some reference application code? Great! Here's how to get started
exploring KillrVideo.

## 1. Install Docker

KillrVideo uses [Docker][docker] to run all the infrastructure you'll need in your local
development environment. (If you want to learn more about how KillrVideo uses Docker, check
out the [Docker Guide][docker-guide] in our documentation.) If you don't already have Docker
installed, you'll need to do so. You can download and install the appropriate tools here:

- [Docker for Windows or Mac][docker-install]

> #### Note on Docker Beta Status
> The native Docker tools for Windows and Mac are currently in beta and are constantly
> evolving. We've seen issues (particularly around networking in the Mac version) crop up 
> when trying to run KillrVideo with those tools. If you encounter issues, we suggest
> installing and using [Docker Toolbox][docker-toolbox] instead. Once the native tools are
> out of beta, this shouldn't be an issue any longer.

## 2. Choose your Programming Language

The KillrVideo reference application is available in multiple programming languages. Use the 
links below to get started with the language you're most comfortable with.

- **[C\# (.NET)][c-sharp]**: A C\# implementation you can explore from Visual Studio. 
- **Java (w/ Achilles)**: A Java implementation using the [Achilles object mapper][achilles] 
for accessing data in DataStax Enterprise. Coming soon.
- **NodeJS**: A JavaScript implementation running on NodeJS. Coming soon.

Check back as we'll be adding more programming languages soon.

## Next Steps

DataStax Enterprise and Cassandra are easy to get started with, but it would be impossible to
show you everything you need to know inside a single reference application like KillrVideo.
We recommend continuing your education at [DataStax Academy][academy]. There you'll find free
self-paced online courses on Cassandra's architecture, data modeling, and more.  

[docker]: https://www.docker.com/
[docker-guide]: /docs/guides/docker/
[docker-install]: https://www.docker.com/products/docker
[docker-toolbox]: https://www.docker.com/products/docker-toolbox
[c-sharp]: /docs/languages/c-sharp/
[achilles]: http://doanduyhai.github.io/Achilles/
[academy]: https://academy.datastax.com/courses
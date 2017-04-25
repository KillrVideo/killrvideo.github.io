# Getting Started with KillrVideo

So you're ready to dig into some reference application code? Great! Here's how to get started
exploring KillrVideo.

## 1. Install Docker

KillrVideo uses [Docker][docker] to run all the infrastructure you'll need in your local
development environment. (If you want to learn more about how KillrVideo uses Docker, check
out the [Docker Guide][docker-guide] in our documentation.) If you don't already have Docker
installed, you'll need to do so. You can download and install the appropriate tools here:

- [Docker for Windows or Mac][docker-install]

> #### Note on Docker
> The native Docker tools for Windows and Mac are currently pretty new and are constantly
> evolving. We've seen issues (particularly around networking in the Mac version) crop up 
> when trying to run KillrVideo with those tools. If you encounter issues, please open an
> issue on GitHub so we can try and solve the problem for everyone.

Once you've got Docker for Windows or Mac installed, it's also really helpful to increase
the amount of RAM allocated to the Docker VM that's running. We recommend allocating **at
least 3 GB** of RAM since DataStax Enterprise and Cassandra are memory-intensive apps:

- Changing [Docker for Mac Preferences][mac-preferences]
- Changing [Docker for Windows Preferences][win-preferences]

## 2. Choose your Programming Language

The KillrVideo reference application is available in multiple programming languages. Use the 
links below to get started with the language you're most comfortable with.

- **[C\# (.NET)][c-sharp]**: A C\# implementation you can explore from Visual Studio. 
- **[Node.js][nodejs]**: A JavaScript implementation running on Node.js.
- **[Java][java]**: A Java implementation you can run via Spring boot
for accessing data in DataStax Enterprise. Coming soon.

Check back as we'll be adding more programming languages soon.

## Next Steps

DataStax Enterprise and Cassandra are easy to get started with, but it would be impossible to
show you everything you need to know inside a single reference application like KillrVideo.
We recommend continuing your education at [DataStax Academy][academy]. There you'll find free
self-paced online courses on Cassandra's architecture, data modeling, and more.  

[docker]: https://www.docker.com/
[docker-guide]: /docs/guides/docker/
[docker-install]: https://www.docker.com/products/docker
[mac-preferences]: https://docs.docker.com/docker-for-mac/#/preferences
[win-preferences]: https://docs.docker.com/docker-for-windows/#/advanced
[c-sharp]: /docs/languages/c-sharp/
[academy]: https://academy.datastax.com/courses
[nodejs]: /docs/languages/nodejs/
[java]: /docs/languages/java/
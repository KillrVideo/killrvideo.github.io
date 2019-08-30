# Getting Started with KillrVideo

So you're ready to dig into some reference application code? Great! Here's how to get started
exploring KillrVideo.

## Install Docker

KillrVideo uses [Docker][docker] to run all the infrastructure you'll need in your local
development environment. (If you want to learn more about how KillrVideo uses Docker, check
out the [Docker Guide][docker-guide] in our documentation.) If you don't already have Docker
installed, you'll need to do so. You can download and install the appropriate tools here:

- [Docker for Windows or Mac][docker-install]

Once you've got Docker for Windows or Mac installed, it's also really helpful to increase
the amount of RAM allocated to the Docker VM that's running. We recommend allocating **at
least 3 GB** of RAM since DataStax Enterprise and Cassandra are memory-intensive apps:

- Changing [Docker for Mac Preferences][mac-preferences]
- Changing [Docker for Windows Preferences][win-preferences]

## Run the Application

The simplest way to run the KillrVideo Application is to run the 
[KillrVideo All-in-one][all-in-one] Docker configuration:

```
git clone https://github.com/KillrVideo/killrvideo-all-in-one.git killrvideo-all-in-one
cd killrvideo-all-in-one
docker-compose up -d
```

This configuration uses `docker-compose` to start KillrVideo, including the web 
application, Java microservice implementations, DataStax Enterprise, and other supporting
infrastructure. As the application initializes, you'll be able to view the web interface at
`http://localhost:3000/`.

Why not take the Tour? This will give you a quick overview of the functionality of the application
as well as some of the details of how it uses Apache Cassandra and DataStax Enterprise.

You can also view a live version of the application at `http://killrvideo.com`. 

## Choose a Programming Language to Dive Deeper

Of course you want to look at some source code to see how this is all put together, and especially
the details of how we implement the database interactions!

The KillrVideo reference application provides service implementations in multiple programming 
languages. Use the links below to get started with the language you're most comfortable with.

- **[Java][java]**: A Java implementation you can run via Spring boot
for accessing data in DataStax Enterprise.
- **[Node.js][nodejs]**: A JavaScript implementation running on Node.js.
- **[C\# (.NET)][c-sharp]**: A C\# implementation you can explore from Visual Studio. 
- **[Python][python]**: A Python implementation - the simplest version!

## Next Steps

DataStax Enterprise and Cassandra are easy to get started with, but it would be impossible to
show you everything you need to know inside a single reference application like KillrVideo.
We recommend continuing your education at [DataStax Academy][academy]. There you'll find free
self-paced online courses on Cassandra's architecture, data modeling, and more.  

[docker]: https://www.docker.com/
[docker-guide]: /docs/guides/docker/
[docker-install]: https://hub.docker.com/?overlay=onboarding
[mac-preferences]: https://docs.docker.com/docker-for-mac/
[win-preferences]: https://docs.docker.com/docker-for-windows/
[c-sharp]: /docs/languages/c-sharp/
[academy]: https://academy.datastax.com/courses
[nodejs]: /docs/languages/nodejs/
[java]: /docs/languages/java/
[python]: /docs/languages/python/
[all-in-one]: https://github.com/KillrVideo/killrvideo-all-in-one
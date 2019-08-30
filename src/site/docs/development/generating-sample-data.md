# Generating Sample Data

[Using the web tier][using-the-web-tier] is a lot more useful when there's some actual data in
your services. Fortunately, there's an app that will run in the background and call your gRPC 
services to add sample data to the application already built. Back when you 
[setup your Docker environment][setup-docker] you may recall that you added a service called
`generator`. Here's the relevant part of the `docker-compose.yaml` file:

```yaml
  # ... other services snipped ...

  # The sample data generator
  generator:
    image: killrvideo/killrvideo-generator:3.0.1
    depends_on:
    - backend
```

This creates and starts an instance of the [KillrVideo Sample Data Generator][killrvideo-generator]
application in Docker. This application listens for your services to become available (as `backend`)
and when they do, it calls your services to add sample users, videos, comments, and more to the site.

## Starting and Stopping the Generator

The generator will try to listen for the gRPC services to become available and when they do,
to start running jobs that insert sample data on a regular schedule. Sometimes when you're 
developing and trying to track down a bug, it can be useful to stop the generator app so it
doesn't interfere in your debugging by making service calls in the background. Since you 
started the app along with all the other dependencies via Docker Compose, it's also possible to 
start and stop the app whenever you want.

To stop it:

```
> docker-compose stop generator
```

Or to start it again once stopped:

```
> docker-compose start generator
```

## Viewing the Generator Logs

It can also be helpful sometimes to take a look at the logs from the Sample Data Generator
since it's making calls to your gRPC services. You can do this at any time using:

```
> docker-compose logs generator
```

There you should be able to see any errors encountered by the application while calling your
services.

[using-the-web-tier]: /docs/development/using-the-web-tier/
[setup-docker]: /docs/development/setup-docker-environment/
[killrvideo-generator]: https://github.com/KillrVideo/killrvideo-generator
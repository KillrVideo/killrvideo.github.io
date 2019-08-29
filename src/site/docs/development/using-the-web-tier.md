# Using the Web Tier

TODO:  the service discovery references need rework. Update version info

When you [Setup the Docker Environment][setup-docker-environment] earlier, you probably
remember that you added a service called `web` to the `docker-compose.yaml` file that you
created. Here's the relevant part of the file you created:

```yaml
  # ... snipped other parts of file ...

  # Start the KillrVideo web UI on port 3000
  web:
    image: killrvideo/killrvideo-web:1.2.0
    ports:
    - "3000:3000"
    depends_on:
    - dse
    - etcd
    environment:
      SERVICE_3000_NAME: web
      KILLRVIDEO_ETCD: "etcd:2379"
```

That container contains the web server and front-end web UI that runs in a browser for 
KillrVideo. If you're curious and want to take a look at that application's code, you can find
it in the [killrvideo-web][killrvideo-web] project on GitHub.

## Accessing the Web UI

When you started up the Docker dependencies with Compose, you ran a command like this:

```
> docker-compose up -d
```

By default, this started a web server listening on port `3000`. To access the web UI, you can
use the IP address from the `KILLRVIDEO_DOCKER_IP` variable in your Docker `.env` file. 
Because the web tier runs as a Docker container, [Registrator][registrator] also registered a
service called `web` (based on the `SERVICE_3000_NAME` variable value) with etcd for service
discovery.

<div class="message is-info">
  <div class="message-header">
    <span class="icon"><i class="fa fa-info-circle"></i></span> Service Discovery Tip
  </div>
  <div class="message-body">
    Use the service discovery code that you wrote to lookup the <code>cassandra</code> service
    earlier to also lookup the `web` service. Then log a message to the console when your
    service implementations start with the URL to that service so users will know what IP
    address to open in a browser for the UI. 
  </div>
</div>

## Viewing the Web Tier Logs

While you're doing development it can be helpful to see what's happening in the web tier as it
makes calls to your backend services. You can use the command:

```
> docker-compose logs web
```

To see the log output from the web tier. If you want more details, the web application
supports setting the default log output level by setting the `KILLRVIDEO_LOGGING_LEVEL`
environment variable. So for example, you could edit the `docker-compose.yaml` file you 
created, changing the `environment` section to add that variable with a setting of `debug`.

The web frontend that runs in the browser also outputs log messages by default. You can see
those by using the web UI with the Chrome debugger open and running.

[setup-docker-environment]: /docs/development/setup-docker-environment/
[killrvideo-web]: https://github.com/KillrVideo/killrvideo-web
[registrator]: https://github.com/gliderlabs/registrator
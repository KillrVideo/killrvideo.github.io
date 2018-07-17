# Getting Started with C\# (.NET)

The .NET version of KillrVideo is a reference application for .NET developers looking to
learn more about using [Apache Cassandra][cassandra] and [DataStax Enterprise][dse] in their
applications and services. It contains sample code that uses:

- The [DataStax .NET Driver][driver] for Cassandra
- Google's [gRPC][grpc]

These instructions assume you already have Visual Studio installed on your local machine.

## Cloning and Running Locally

Like all KillrVideo implementations, the .NET version uses [Docker][docker] to run all its
dependencies in your local development environment. If you haven't already, please read and
follow the instructions in [Getting Started][getting-started] to install Docker. Once you
have Docker up and running, follow these steps:

1. Clone the C\# project's [GitHub repository][repo]:
    ```
    > git clone https://github.com/LukeTillman/killrvideo-csharp.git
    ```
1. From inside the repository you just cloned, setup the Docker environment for the first
time by running:
    ```
    > .\setup-docker.bat
    ```
    This should create a `.env` file with some environment variables, as well as pull all the
    Docker images that the application needs to run.

    If you are on MAC you can generate the same file by doing :
    ```
    > ./setup-docker.sh
    ```

1. Start the docker dependencies that you just pulled down via `docker-compose`:
    ```
    > docker-compose up -d
    ```
    This starts up things like a DataStax Enterprise node, the Web UI, etc. You can learn
    more about how we use Docker in our [Docker Guide][docker-guide] documentation.

1. Open the main solution (**`/src/KillrVideo.sln`**) in Visual Studio.
1. Set the **KillrVideo** project as the Startup Project.
   * Right-click on the KillrVideo project node in Visual Studio's Solution Explorer window 
     and choose **Set as Startup Project** from the context menu.
1. Locate the (**`src/KillrVideo/Configuration/HostConfigurationFactory.cs`**) class within the project and edit the `ConfigEnvFilePath` to match tne `.env` file location.
1. Press **`F5`** to build the solution and run with debugging.

## Opening the Web UI

When KillrVideo starts, you'll see a bunch of log output to the console telling you about the
various things it's doing. You should see output that looks something like this:

![Console Startup Output](/assets/images/csharp-startup.png)

One of the last lines in the log output will tell you where to open a web browser in order to
see the web application. The web UI makes calls to the C\# microservices running on your
local machine in Visual Studio. Look under the `Services` folder in Visual Studio's Solution
Explorer window to explore that code and add breakpoints. As you interact with the web UI,
you'll trigger those breakpoints in the C\# code.

## Using DataStax Studio

The `docker-compose` file that you ran above started an instance of [DataStax Studio][studio], 
an interactive tool for querying, exploring, analyzing, and visualizing both graph and tabular data. 
Check out the [Using DataStax Studio][using-studio] page for more information.

## Learn More

Check out the [Documentation][docs] section for a lot more information on the architecture of
KillrVideo and how the Web Tier interacts with the microservices running on your machine.


[cassandra]: http://cassandra.apache.org/
[dse]: http://www.datastax.com/products/datastax-enterprise
[driver]: https://github.com/datastax/csharp-driver
[grpc]: http://www.grpc.io/
[docker]: https://www.docker.com/
[getting-started]: /getting-started/
[repo]: https://github.com/LukeTillman/killrvideo-csharp
[docker-guide]: /docs/guides/docker/
[docs]: /docs/
[studio]: https://www.datastax.com/products/datastax-studio-and-development-tools
[using-studio]: /docs/guides/datastax-studio/
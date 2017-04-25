# Getting Started with Java

The Java version of KillrVideo is a reference application for Java developers looking to
learn more about using [Apache Cassandra][cassandra] and [DataStax Enterprise][dse] in their
applications and services. It contains sample code that uses:

- The [DataStax Java Driver][driver] for DataStax Enterprise
- Google's [gRPC][grpc]

These instructions assume you already have a [Java Development Kit][jdk] version 1.8 or higher installed. 

## Cloning and Setup

Like all KillrVideo implementations, the Java version uses [Docker][docker] to run all its
dependencies in your local development environment. If you haven't already, please read and
follow the instructions in [Getting Started][getting-started] to install Docker. Once you
have Docker up and running, follow these steps:

1. Clone the Java project's [GitHub repository][repo]:
    ```
    > git clone https://github.com/KillrVideo/killrvideo-java.git
    ```
1. We use [Maven][maven] to build and package the KillrVideo Java implementation. Make sure you have Maven 3 or 
later installed and initiate a clean build from the root of the repository. This will perform all [GRPC][grpc]
code generation, compile the code, and run unit tests:
    ```
    > mvn clean test
    ```
    You should end up with the build output in the `target` folder.    

1. Setup the Docker environment for the first time by running:
    ```
    > ./setup-docker.sh
    ```
    Or on Windows:
    ```
    > .\setup-docker.bat
    ```
    This should create a `.env` file with some environment variables, as well as pull all the
    Docker images that the application needs to run.

1. Start the docker dependencies that you just pulled down via `docker-compose`:
    ```
    > docker-compose up -d
    ```
    This starts up things like a DataStax Enterprise node, the Web UI, etc. You can learn
    more about how we use Docker in our [Docker Guide][docker-guide] documentation.
  
## Running the Code

Now that you've got the environment setup and the project built, you can run the project and
explore the code in your IDE of choice with a debugger attached. We have instructions for running KillrVideo 
in a couple popular IDEs:

- [IntelliJ IDEA](#running-in-intellij-idea)
- [Eclipse](#running-in-eclipse)

### Running in IntelliJ IDEA

To debug in [IntelliJ IDEA][idea], you'll first need to create a Run/Debug configuration.

1. Open the root project folder with IntelliJ IDEA.
1. TBD

### Running in Eclipse

(Coming Soon)

## Opening the Web UI

When KillrVideo starts, you'll see a bunch of log output to the console telling you about the
various things it's doing. You should see output that looks something like this:

![Console Startup Output](/assets/images/java-startup.png)

One of the last lines in the log output will tell you where to open a web browser in order to
see the web application. The web UI makes calls to the Java microservices running on your
local machine. Look in the `/src/main/java/killrvideo/service` folder to explore the service code and add
breakpoints.

## Learn More

Check out the [Documentation][docs] section for a lot more information on the architecture of
KillrVideo and how the Web Tier interacts with the microservices running on your machine.


[cassandra]: http://cassandra.apache.org/
[dse]: http://www.datastax.com/products/datastax-enterprise
[driver]: https://github.com/datastax/java-dse-driver
[grpc]: http://www.grpc.io/
[idea]: https://www.jetbrains.com/idea
[eclipse]: https://www.eclipse.org/
[docker]: https://www.docker.com/
[getting-started]: /getting-started/
[repo]: https://github.com/KillrVideo/killrvideo-java
[docker-guide]: /docs/guides/docker/
[docs]: /docs/
[maven]: https://maven.apache.org/
[jdk]: http://www.oracle.com/technetwork/java/javase/downloads/index.html


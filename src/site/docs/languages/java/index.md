# Getting Started with Java

TODO: need to rerun instructions to see if they are current

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
- [Command Line](#running-as-command-line)

### Running in IntelliJ IDEA

To debug in [IntelliJ IDEA][idea], you'll first need to create a Run/Debug configuration.

1. In IntelliJ IDEA, select from the `File->New` menu the `Project from Existing Sources` option and then select the
directory where you cloned the Git repository. Select the option which configures the project as a Maven project.
This will enable you to run Maven targets such as those referenced above from the "Maven Projects" window (typically
in the upper right).

1. Create/edit a run configuration for the main class by selecting the `Run->Edit Configurations` menu option and 
selecting the main class `KillrVideoServer`, which should be listed under "Spring Boot Configurations" at left. 
In order to run in the IDE, you will need to set the same environment variables as were set in the `.env` file 
you created above when running the `setup-docker` script. For an example of this configuration see the following image:

![IntelliJ IDEA run configuration](/assets/images/idea-configuration.png)

Once the configuration has been created you can invoke it from the `Run` menu or by right clicking on the 
`KillrVideoServer` class in the "Project" window to the left.

### Running in Eclipse

To debug in [Eclipse][eclipse], you'll need to import project and create a Run/Debug configuration.

- **Patch m2e Eclipse to work `maven-os-plugin`** : As `m2e` does not evaluate the extension specified 
in a `pom.xml` you need to install an additional Eclipse plugin. To do so please download [`os-maven-plugin-1.5.0.Final.jar`][os-plugin-url] and put it into the `<ECLIPSE_HOME>/plugins` directory. (As you might have noticed, `os-maven-plugin` is a Maven extension, a Maven plugin, and an Eclipse plugin). You will need to restart eclipse.

- **Import Maven Project**: In Eclipse, select `File->Import`, in the menu pick `Maven>Existing Maven Projects` and select the directory where you cloned the Git repository. The `pom.xml` file should appear in the list, validate that associated box is checked then click `finish`.

![Eclipse Import Project](/assets/images/eclipse-import.png)

- **Update classpath**: During `build` maven phase classes are generated for both GRPC and Gremling DSL in `generated-sources`. 
Eclipse does not include all paths by default to the classpath, you need an extra configuration step. Right-click on your project and 
select `properties`. Then, in the tree on the left part of the wizard select `Java Build Path`, `Add Folder` and browse project 
to check `target/generated-sources/annotations` box as displayed in the picture below, apply and close. 
You project should now compile without error in the UI.

![Eclipse Add Annotations](/assets/images/eclipse-annotation.png)

- **Run configuration**: Right-click on your project and select `Run As...>Run As Java Applications`. (*if you are using Eclipse STS you can also
`Run As...>Run As Spring Boot App`*). On the main tab enter name `Run KillrVideo` and for main class field please use `killrvideo.KillrVideoServer`.
You will need to set the same environment variables as were set in the `.env` file you created above when running the `setup-docker` 
script. Select `Environment` tag and add the variables as shown in the picture below : `KILLRVIDEO_HOST_IP`, `KILLRVIDEO_DOCKER_IP`

![Eclipse run configuration](/assets/images/eclipse-run.png) 

### Running as command line

The purpose of KillrVideo application is to illustrate how to implement an application with DataStax Enterprise and thus 
we expect you to import the source code in a IDE to manipulate and understand the code. To simply execute the application
you can execute the following:`mvn spring-boot:run -D=KILLRVIDEO_HOST_IP=10.0.75.1 -D=KILLRVIDEO_DOCKER_IP=10.0.75.1`


## Opening the Web UI

The Web UI will be started on the IP identified by the `KILLRVIDEO_HOST_IP` defined in the `.env` file above at
port 3000. For example, this is typically something like [http://10.0.75.1:3000](http://10.0.75.1:3000).
 
If you have trouble finding the web UI, it should be registered with etcd. You can discover it by using a query 
such as [http://10.0.75.1:2379/v2/keys/killrvideo/services/web](http://10.0.75.1:2379/v2/keys/killrvideo/services/web),
which will produce output like this:

`
{"action":"get","node":{"key":"/killrvideo/services/web","dir":true,
 "nodes":[{"key":"/killrvideo/services/web/7546aded6d2c:killrvideo_web_1:3000","value":"10.0.75.1:3000",
 "modifiedIndex":8,"createdIndex":8}],"modifiedIndex":8,"createdIndex":8}}
`

## Using DataStax Studio

The `docker-compose` file that you ran above started an instance of [DataStax Studio][studio], 
an interactive tool for querying, exploring, analyzing, and visualizing both graph and tabular data. 
Check out the [Using DataStax Studio][using-studio] page for more information.

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
[studio]: https://www.datastax.com/products/datastax-studio-and-development-tools
[using-studio]: /docs/guides/datastax-studio/
[os-plugin-url]: http://repo1.maven.org/maven2/kr/motd/maven/os-maven-plugin/1.5.0.Final/os-maven-plugin-1.5.0.Final.jar
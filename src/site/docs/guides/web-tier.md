# Web Tier Implementation

When talking about the "Web Tier" in KillrVideo, we're really talking about two separate
components: the Web Client and the Web Server. KillrVideo is meant to be a reference
application for people looking to learn about using Cassandra and DataStax Enterprise with
the programming language of their choice. The Web Tier just supports the UI and doesn't 
directly interact with DSE. All of the "interesting" code that does interact with DSE lives 
in the microservices.

One of the goals of this project is to create a standalone Web Tier than can be reused by
the various Microservices Tier implementations. As a result, the [killrvideo-web][killrvideo-web]
project was created. That project contains a standalone Web Server and Web Client (all 
written in JavaScript) and is packaged as a [Docker container](https://hub.docker.com/r/killrvideo/killrvideo-web)
which can be run to provide a common UI for KillrVideo, regardless of what programming
language the Microservices Tier is using. 

Let's take a look at how the Web Tier works before diving into the microservices in the
[next section][next].

## Web Client

The Web Client is a [single page application](https://en.wikipedia.org/wiki/Single-page_application)
that runs in the browser is implemented in JavaScript. Some of the notable libraries used
include:

- [**React**](https://facebook.github.io/react/): for rendering the UI based on the
application state using components.
- [**Redux**](http://redux.js.org/): for maintaining the application state and changing it
in a predictable way.
- [**Falcor**][falcor]: for fetching data from the Web Server
efficiently.
- [**Bootstrap**](http://getbootstrap.com/): for base CSS styling and common components.

All of the assets for the Web Client are bundled with [webpack](https://webpack.github.io/)
and then served up by the Web Server.

## Web Server

The Web Server is a NodeJS application that serves up the static assets for the Web Client
and routes requests to the Microservices Tier to retrieve data and support various user
actions. Some of the notable libraries used include:

- [**Express**](http://expressjs.com/): for routing incoming HTTP requests to the 
appropriate handlers.
- [**Falcor Router**](http://netflix.github.io/falcor/documentation/router.html): takes 
requests routed through Express from the Falcor client and then calls the appropriate 
backend microservices.
- [**gRPC**][grpc]: provides communication with the backend microservices over HTTP/2
where the service contracts are defined via Protocol Buffers.

The interaction between the Web Server and the Microservices Tier via [gRPC][grpc] will be
covered in great detail in the [next section][next]. But it's probably worth discussing the
typical interaction between the Web Client and the Web Server via [Falcor][falcor].

## Web Client and Server Communication via Falcor

A complete explanation of [Falcor][falcor] is definitely outside of the scope of this
document (and the Netflix documentation is pretty good if you're interested in digging in).
But let's take a quick high level look at one of those requests in KillrVideo.

Falcor encourages you to think of your data model as a *graph*. When the Web Client makes a 
request to the server, it makes a request for a *path* or *paths* in that graph. So for
example, let's say I'm displaying a video in the UI. The paths I request via Falcor might 
look something like this:

```
GET: /model.json

videosById['12345']['name', 'description', 'addedDate']
videosById['12345'].author['firstName', 'lastName', 'email']
```

On the Web Server, the Falcor Router is setup to handle requests to `/model.json`. It takes
the path or paths requested by the client, and then tries to match them against routes
which have been defined on the server. Here's an example route definition that matches some
of our example paths and would be called by the Falcor Router to handle the request:

```javascript
// Get video details by id
{
    route: 'videosById[{keys:videoIds}]["videoId", "addedDate", "description", "name", "author"]',
    get(pathSet) {
        // ... Handle request by making a call to the Video Catalog service via gRPC ...
    }
}
```

You might notice that this route matches `author`, but doesn't provide the `firstName`,
`lastName`, and `email` attributes of the author. How are those retrieved? Well, one cool
thing about Falcor is that routes can return references to other parts of the graph as part
of their response. In our Video Catalog service, we store a `userId` for the author of a 
given video, but we don't store the details of that user. So our route above might return a
response that looks something like this:

```json
{
    "videosById": {
        "12345": {
            "name": "Burrito Cat",
            "description": "A cat wrapped in a burrito because who doesn't love that?",
            "addedDate": "2016-06-29T18:25:43.511Z",
            "author": {
                "$type": "ref",
                "value": [ "usersById", "99999" ]
            }
        }
    }
}
```

The `author` value returned is a special primitive type in Falcor's [JSON Graph](http://netflix.github.io/falcor/documentation/jsongraph.html)
spec that represents a reference to another part of the graph (in this case, we got a 
reference to `usersById['99999']`). The Falcor router will automatically try to follow any
references returned by routes (before returning a response to the client), so if we have 
another route definition that looks like this:

```javascript
// Get user details by id
{
    route: 'usersById[{keys:userIds}]["userId", "firstName", "lastName", "email"]',
    get(pathSet) {
        // ... Handle request by making a call to the User Management service via gRPC ...
    }
}
```

That route will be called and asked for the `firstName`, `lastName`, and `email` of user
`99999` in order to fill in the author information from the original request. In this way,
multiple microservices can be involved in constructing the response for a given request.
This makes Falcor a nice fit for sitting in front of a microservices architecture like
KillrVideo's.

## Session Storage in Cassandra / DataStax Enterprise

In the beginning of this guide, we talked about how all the code that's actually
interacting with DataStax Enterprise lives in the microservice implementations. (And as a
result, most users looking to KillrVideo as a reference app probably won't be interested
in digging through the code of the Web Tier.) There is, however, one exception to that
statement: web session storage. The Web Server does use Cassandra to store session data
for a given user.

Web session storage in Cassandra is done with the [Express Session](https://github.com/expressjs/session) 
middleware and the [Cassandra Store](https://github.com/webcc/cassandra-store) plugin for
that middleware. Since that plugin does all the "heavy lifting" of interacting with
Cassandra, it's still probably not of interest to end users. But that code is available in
the [GitHub repository for killrvideo-web][killrvideo-web] if you're interested.

Next, let's take a look at some of the implementation details of the Microservices Tier 
being called by the Web Server.

[Next: Microservices Tier Implementation][next]


[next]: /docs/guides/microservices-tier/
[killrvideo-web]: https://github.com/killrvideo/killrvideo-web
[falcor]: http://netflix.github.io/falcor/
[grpc]: http://www.grpc.io/
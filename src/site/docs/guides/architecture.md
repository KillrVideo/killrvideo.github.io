# High Level Architecture Overview

KillrVideo is a video sharing web application. As such, it's got a tiered setup that's
pretty common for web applications:

- **Web Client:** The web UI that runs in a browser and is interacted with by the user. It
sends requests to a Web Server (via HTTP, web sockets, etc.)
- **Web Server:** Serves up static assets for the client (i.e. JavaScript, CSS, images) and
responds to requests from the Web Client by routing them to the appropriate service(s) on
the backend.
- **Microservices Tier:** A tier of independent services that house the data and the logic
for the features and functionality of the site.

We'll get into the details of how these tiers are actually implemented in the [next section][next],
but first let's take a closer look at the Microservices Tier conceptually.  

## Microservices Tier

KillrVideo uses a [microservices](http://martinfowler.com/articles/microservices.html) style 
architecture where the site is broken up into multiple smaller services where each service
is responsible for providing the functionality for a specific feature. This is the current
list of services and the functionality they are responsible for:

- **Comments:** Allows users to comment on videos and keeps track of those comments.
- **Ratings:** Allows users to rate videos (on a scale of 1-5) and keeps track of those
ratings.
- **Search:** Indexes the available videos for searching by keyword and provides search
suggestions (i.e. typeahead) support.
- **Statistics:** Keeps track of statistics for videos like how many times they've been
played back.
- **Suggested Videos:** Provides suggestions for videos similar to another video as well
as personalized video suggestions for a particular user.
- **Uploads:** Allows users to upload videos to the site and handles converting uploaded
video files to a format that's compatible with the site.
- **User Management:** Manages user accounts including signing up and logging in/out.
- **Video Catalog:** Keeps track of all the videos available for playback and the details
of those videos (i.e. title, description, etc.)

Each of these services is designed to be completely independent and not have a dependency 
on any other service being available to do its job. What does this mean in practice? That 
the implementations of our services shouldn't be making calls to other service APIs in 
order to do their work when at all possible.

So if we don't want our services directly calling other service APIs, how will the services
interact with each other?

## Using Events for Service Collaboration

In KillrVideo we've chosen to use [events for collaboration](http://martinfowler.com/eaaDev/EventCollaboration.html)
between services rather than having services calling each other directly. Each service is
for publishing events about interesting things that happen inside of them. Other services
can then subscribe to any events they are interested in and react accordingly.

> #### An Example from KillrVideo
> Whenever a new YouTube video is added to the video catalog, the **Video Catalog** 
> service publishes a `YouTubeVideoAdded` event. That event contains some of the details
> of the video that was added (like it's id, name, description, etc.). Other services can
> (and do) subscribe to this event if they are interested. For example, the **Search**
> service might want to add the video to its index so the video starts showing up in
> search results. Or the **Suggested Videos** service may want to figure out what other
> videos are similar to that one so it can offer suggestions.

If services are publishing events and possibly subscribing to them as well, this implies
that we'll need some sort of mechanism for doing [Publish-subscribe](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern) 
messaging. We'll cover the specifics of actually implementing pub-sub shortly.

[Next: Web Tier Implementation][next]

[next]: /docs/guides/web-tier/
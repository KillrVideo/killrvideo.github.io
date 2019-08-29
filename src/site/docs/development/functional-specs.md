# Microservice Functional Specifications

Implementations of The KillrVideo microservice tier are provided in multiple languages including Java, C#, 
and JavaScript. The syntax of the operations supported by the services are defined in the GRPC contracts. 
However, the GRPC contracts don't specify the behavior supported by each operation.

To facilitate the creation of implementations in additional languages, we provide here the functional
specifications for each service.

## Comment Service

### CommentOnVideo Operation
This operation allows a user to comment on a video

#### Inputs
- `user_id` - unique identifier of the user that has written the comment (required)
- `video_id` - unique identifier of the video the comment is about (required)
- `comment_id` - unique identifier for the comment id (required)
- `comment` - text of comment given on video (required) 


#### Behavior
1. Validate input for all required values
1. Insert records representing the comment into the `comments_by_user` and `comments_by_video` tables
- These inserts should be grouped in a logged batch to ensure they succeed or fail together
1. Publish a `CommentOnVideo` event

#### Outputs
This method returns no results

### GetUserComments Operation
This operation gets comments on any videos added by a paritular user

#### Inputs
- `user_id` - unique identifier of the user whose comments will be displayed
- `page_size` - max number of comments to be returned in a single response (required)
- `starting_comment_id` - starting comment id for the search (optional)
- `paging_state` - paging state returned from the previous request (optional)

#### Behavior
1. Retrieve comments from the `comments_by_user` table, using the provided user ID and any paging state
#### Outputs
This method returns an optional `paging_state`, and the following details for each `comment`
- `comment_id` - unique identifier for the comment
- `video_id` -  unique identifier for the video
- `comment` - comment that was made on the video by this user


### GetVideoComments Operation
This operation gets comments added by any user on a partitular video
#### Inputs
- `video_id` - unique identifier of the video whose comments will be returned
- `page_size` - max number of comments to be returned in a single response (required)
- `starting_comment_id` - starting comment id for the search (optional)
- `paging_state` - paging state returned from the previous request (optional) 

#### Behavior
1. Retrieve comments from the `comments_by_video` table, using the provided video ID and any paging state

#### Outputs
This method returns an optional `paging_state`, and the following details for each `comment`
- `comment_id` = unique identifier for the comment
- `user_id` = unique identifier for the user that created this comment
- `comment` = comment that was made on this video by any user

## Ratings Service

### RateVideo operation
This operation allows a user to rate a video

#### Inputs
- `user_id` - unique identifier for the user (required)
- `video_id` - unique identifier for the video (required)
- `rating` - integer rating provided by the user for this video (required)

#### Behavior
1. Validate input
1. Insert records representing the rating into the `video_ratings` and `video_ratings_by_user` tables.
    - These inserts should be grouped in a logged batch to ensure they succeed or fail together. 
    - The `video_ratings` table uses counters to accumulate the number of reviews for each video
    and the total value of the ratings (thus enabling the client to calculate an average review value). 
    Remember that updating a counter column increments the counter by the provided value.
1. Publish a `UserRatedVideo` event.

#### Output
This method returns no results.

### GetRating operation
This operation returns the rating statistics for a video

#### Inputs
- `video_id` - unique identifier for the video (required)

#### Behavior
1. Validate input
1. Retrieve the rating from the `video_ratings` table by ID

#### Output
This method returns a `response` object containing: 
- `video_id` - unique identifier for the video
- `ratings_count` - number of times the video has been rated
- `ratings_total` - sum of all of the ratings

### GetUserRating operation
This operation returns a user's rating of a specific video 
 
#### Inputs
- `video_id` - unique identifier for the video (required)
- `user_id` - unique identifier for the user (required)
 
#### Behavior
 1. Validate input
 1. Retrieve the user's rating from the `video_ratings_by_user` table using the provided IDs
 
 #### Output
 This method returns a `response` object containing: 
 - `video_id` - unique identifier for the video
 - `user_id` - unique identifier for the user
 - `rating` - the user's rating for the video, or 0 if the user hasn't rated the video

## Search Service

### SearchVideos operation
This operation returns videos matching a given query term

#### Inputs
- `query` - the term to match (required)
- `page_size` - max number of videos to be returned in a single response (required)
- `paging_state` - paging state returned from the previous request (optional)

#### Behavior
1. Validate input
1. Use DSE Search via CQL syntax to obtain videos matching the query term from the `videos` table, 
using any paging state provided.
    - Recommendation: use the `name`, `description`, and `tags` columns for matching
    - For details of the paging algorithm see this [blog post][paging-blog]
1. Create a video preview object for each matching video.

#### Output
This method returns a `response` object containing the original `query`, an optional `paging_state` if additional 
results are available, and a preview for each `video` including: 
- `video_id` - unique identifier for the video 
- `user_id` - unique identifier of the user who uploaded the video 
- `name` - name or title of the video 
- `preview_image_location` - string representing URL of the preview image
- `added_date` - Date / time the video was added to the system


### GetQuerySuggestions operation
This operation returns search query suggestions, for example, as could be used for typeahead support

#### Inputs
- `query` - the string to use to find matching terms (required)
- `page_size` - max number of terms to be returned in a single response (required)

#### Behavior
1. Validate input
1. Use DSE Search via CQL syntax to obtain possible terms matching the query term from the `videos` table, 
using any paging state provided.
    - Recommendation: use the `name`, `description`, and `tags` columns as sources of suggestions, use regular 
    expressions to isolate complete words as candidate terms, and try to eliminate stop words such as "and", "or", etc.
    - For details of the paging algorithm see this [blog post][paging-blog]

#### Output
This method returns a list of `suggestions` - strings that could be used in future queries to SearchVideos


## Statistics Service

### RecordPlaybackStarted operation
This operation records that playback started for a given video

#### Inputs
- `video_id` - unique identifier for the video (required)

#### Behavior
1. Validate input
1. Increment the playback counter for this video in the `video_playback_stats` table.
    - Remember that updating a counter column increments the counter by the provided value.

#### Output
This method returns no results.

### GetNumberOfPlays operation
This operation returns the number of plays for a given video or set of videos

#### Inputs
- `video_ids` - a list of unique IDs representing the videos for which statistics are requested (required)

#### Behavior
1. Validate input
1. Retrieve the statistics for each video from the `video_playback_stats` table by ID

#### Output
This method returns a `response` object containing `stats` for each video: 
- `video_id` - unique identifier for the video
- `views` - number of times the video has been viewed

## Suggested Videos Service

_Note: Implementations of service frequently subscribe to events published by other services in order to 
 maintain awareness of the relationships between users, videos, ratings, and so on._

### GetRelatedVideos operation
This operation returns a list of videos that are recommended based on a given video 

#### Inputs
- `video_id` - unique identifier for the video (required)
- `page_size` - max number of videos to be returned in a single response (optional)
- `paging_state` - paging state returned from the previous request (optional)

#### Behavior
1. Validate input
1. Generate recommended videos based on the provided video.
    - Consider how to identify videos that are related to the provided video, for example videos that have 
    similar tags or user ratings.

#### Output
This method returns a list of recommended videos.

### GetSuggestedForUser operation
This operation returns a list of videos that are recommended for a given user

#### Inputs
- `user_id` - unique identifier for the user (required)
- `page_size` - max number of videos to be returned in a single response (optional)
- `paging_state` - paging state returned from the previous request (optional)

#### Behavior
1. Generate recommended videos based on the provided user.
    - Consider how to identify videos that were highly rated by similar users, where similarity might be measured
    in terms of viewing habits and preferences.

#### Output
This method returns a `response` object containing the original `user_id` as well as an object for each video 
and an optional `paging_state`: 


## User Management Service
This service supports adding user profiles, verifying user credentials against a profile, and retrieving
one or more profiles.
 
_Note: This service could be extended to allow updating and deleting user profiles._

### CreateUser operation
This operation creates a new user in the KillrVideo system

#### Inputs
- `user_id` - a unique ID generated by the client requesting the user creation (required)
- `first_name` - first name of the user (required)
- `last_name` - last name of the user (required)
- `email` - user's email address, must be unique and a valid email address format (required)
- `password` - user's desired password (required)

#### Behavior
1. Validate input
1. Insert records representing the new user into the `users` and `user_credentials` tables.
    - This should be done using a lightweight transaction (LWT) to ensure the user email does not already exist. If
    the user already exists an error is reported. 
    - The password should be stored as a hashed value rather than the actual password for security purposes.
1. Publish a `UserCreated` event.

#### Output
This method returns no results.

### VerifyCredentials operation
This operation checks user provided credentials (email and password) and returns the appropriate
user ID if successful.

#### Inputs
- `email` - user's email address (required)
- `password` - user's password (required)

#### Behavior
1. Retrieve the credentials from the `user_credentials` tables, using the provided `email`.
    - Return an error if the record is not found
1. Hash the provided `password` and compare it to the hashed `password` retrieved from the database
    - Return an error if the hashed values do not match
    
#### Output
If the credentials are correct, this method returns the `user_id` associated with the credentials.

### GetUserProfile operation
Gets a user or group of user's profiles

#### Inputs
- `user_ids` - a list of unique IDs representing the account profiles to be returned

#### Behavior
1. Validate that at least one user account is requested
1. Retrieve the account profiles from the `users` table by ID
    - Hint: using the CQL `IN` clause to request multiple profiles in a single request, 
    or using multiple requests for single profiles requested asynchronously in parallel are
    both valid ways to get the profiles.

#### Output
This method returns a `profile` object for each profile it was able to load successfully, or an error if
zero results were found (partial success is ok).
- `user_id` - unique identifier for the user
- `first_name` - first name of the user
- `last_name` - last name of the user
- `email` - user's email address

## Video Catalog Service
This service supports adding videos, retrieving videos, and retrieving video previews for
recent videos and specific users.

### SubmitUploadedVideo operation
This operation submits an uploaded video to the catalog.

_Note: this operation is currently unused because of its association with the Uploads Service_

### SubmitYouTubeVideo operation
This operation submits a YouTube video to the catalog. The actual video is not stored into KillrVideo, only the metadata.

#### Inputs
- `video_id` - unique identifier for the video generated by the client (required)
- `user_id` - unique identifier of the user uploading the video (required)
- `name` - name or title of the video (required)
- `description` - synopsis of the video (required)
- `tags` - list of tags to associate with the video 
- `you_tube_video_id` - string representing the unique identifier used by YouTube for this video. (required)

#### Behavior
1. Validate input
1. Insert records representing the new user into the `videos`, `latest_videos` and `user_videos` tables.
    - These inserts should be grouped in a logged batch to ensure they succeed or fail together. 
    - The tables include a column to store a preview image location. For YouTube videos this location can be calculated 
    from the YouTube video ID according to the pattern: `//img.youtube.com/vi/<ID>/hqdefault.jpg`
1. Publish a `YouTubeVideoAdded` event.

#### Output
This method returns no results.

### GetVideo operation
This operation gets a video and all its details from the catalog.

#### Inputs
- `video_id` - unique ID representing the video to be returned

#### Behavior
1. Retrieve the video details from the `videos` table by ID

#### Output
This method returns the following details for the video if it was able to load successfully:
- `video_id` - unique identifier for the video 
- `user_id` - unique identifier of the user who uploaded the video 
- `name` - name or title of the video 
- `description` - synopsis of the video
- `location_type` - `YOUTUBE` (0) or `UPLOAD` (1, unused)
- `tags` - list of tags associated with the video 
- `location` - `you_tube_video_id` for a YouTube video, or URL for an uploaded video
- `added_date` - Date / time the video was added to the system

### GetVideoPreviews Operation
This operation gets video previews for a limited number of videos from the catalog

#### Inputs
- `video_ids` - a list of unique IDs representing the video previews to be returned

#### Behavior
1. Retrieve the video preview details from the `videos` table by ID

#### Output
This method returns the following details for each `video` it was able to load successfully:
- `video_id` - unique identifier for the video 
- `user_id` - unique identifier of the user who uploaded the video 
- `name` - name or title of the video 
- `preview_image_location` - string representing URL of the preview image
- `added_date` - Date / time the video was added to the system

### GetLatestVideoPreviews Operation
This operation gets video previews for the latest (i.e. newest) videos from the catalog

#### Inputs
- `page_size` - max number of videos to be returned in a single response (required)
- `starting_added_date` - starting Date / Time for the search (optional)
- `starting_video_id` - unique ID of the last video from the previous request (optional)
- `paging_state` - paging state returned from the previous request (optional)

#### Behavior
1. Retrieve the video preview details from the `latest_videos` table, using any paging state provided.
    - For details of the paging algorithm see this [blog post][paging-blog]

#### Output
This method returns an optional `paging_state`, and the following details for each `video` it was able to load successfully:
- `video_id` - unique identifier for the video 
- `user_id` - unique identifier of the user who uploaded the video 
- `name` - name or title of the video 
- `preview_image_location` - string representing URL of the preview image
- `added_date` - Date / time the video was added to the system

### GetUserVideoPreviews Operation
This operation gets video previews for videos added to the site by a particular user

#### Inputs
- `user_id` - unique identifier of the user whose uploads we're previewing 
- `page_size` - max number of videos to be returned in a single response (required)
- `starting_added_date` - starting Date / Time for the search (optional)
- `starting_video_id` - unique ID of the last video from the previous request (optional)
- `paging_state` - paging state returned from the previous request (optional)

#### Behavior
1. Retrieve the video preview details from the `user_videos` table, using the provided user ID and any paging state provided.
    - For details of the paging algorithm see this [blog post][paging-blog]

#### Output
This method returns an optional `paging_state`, and the following details for each `video` it was able to load successfully:
- `video_id` - unique identifier for the video 
- `user_id` - unique identifier of the user who uploaded the video 
- `name` - name or title of the video 
- `preview_image_location` - string representing URL of the preview image
- `added_date` - Date / time the video was added to the system

[paging-blog]: https://academy.datastax.com/content/paging-killrvideo

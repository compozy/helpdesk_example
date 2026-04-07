API/REST/HTTP

* Use the Express library to map endpoints and handle HTTP requests and responses. Never install different libraries for this purpose.

```ts
// Good
import express from "express";
const app = express();
app.get("/playlists", listPlaylists);
```

* Follow the REST pattern for queries, keeping resource names in English and plural, allowing navigability in nested resources. For example: /playlists/:playlistId/videos or /customers/:customerId/invoices. In these cases, nesting makes sense because each playlist can have a set of videos and each customer can have a set of invoices.

```
GET /playlists/:playlistId/videos
GET /customers/:customerId/invoices
```

* Compound resources and verbs must use kebab-case. For example: scheduled-events or process-payment.

```
GET /scheduled-events
POST /process-payment
```

* Avoid creating endpoints with more than 3 resources. In these cases, prefer more direct calls. The exception is when there is a security rule tied to a specific set of endpoints, for example: /public or /users/:userId.

```
// Bad
GET /channels/:channelId/playlists/:playlistId/videos/:videoId/comments

// Good
GET /videos/:videoId/comments
```

* For mutations, do NOT follow the standard REST pattern. Use a combination of REST for navigating resources and verbs to represent the action being performed, always with POST. For example: /users/:userId/change-password or /users/:userId/block, and NOT PUT /users/:userId.

```ts
// Good
POST /users/:userId/change-password
POST /users/:userId/block

// Bad
PUT /users/:userId
```

* The request and response payload format must always be JSON, unless a different format such as text or XML is specified.

* Always follow security rules, validating authentication and authorization. Never create endpoints without security middlewares. Follow the navigation pattern of existing endpoints, and if unsure, ask before implementing.

* Return types:

- Return 200 when successful

- Return 404 if a resource is not found

- Return 500 if it is an unexpected error

- Return 422 if it is a business rule error

- Return 400 if the request is malformed

- Return 401 if the user is not authenticated

- Return 403 if the user is not authorized

```ts
app.get("/playlists/:id", async (req, res) => {
  const playlist = await findPlaylist(req.params.id);
  if (!playlist) return res.status(404).json({ message: "Playlist not found" });
  return res.status(200).json(playlist);
});
```

* Document the endpoints, methods, and status codes for each endpoint using OpenAPI.

* Implement pagination for more complex queries, based on limit and offset passed via query string.

```
GET /playlists?limit=10&offset=20
```

* Implement partial response for queries that return large amounts of data.

```
GET /playlists?fields=id,name,createdAt
```

* Use the fetch to make calls to external APIs when necessary. Never install different libraries for this purpose.

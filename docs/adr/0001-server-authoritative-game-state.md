# Server-authoritative game state

The server holds the deck, every player's hand, and the full game state, and validates every move. Clients send intents (for example "play heart J") and receive a view filtered to what that player may see. We chose this because hands are hidden information and paid card skins mean the client cannot be trusted; client-side logic with peer sync would leak hands and allow cheating.

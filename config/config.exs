# This file is responsible for configuring your application
# and its dependencies with the aid of the Mix.Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
use Mix.Config

config :cuisine_website,
  ecto_repos: [CuisineWebsite.Repo]

# Configures the endpoint
config :cuisine_website, CuisineWebsiteWeb.Endpoint,
  url: [host: "localhost"],
  secret_key_base: "XA9T3aPeZQXNGIRZGSqdS7wuPwlx/NNuUPrf8EmFM2KbcjRbv+AL09ecrCGmb/mq",
  render_errors: [view: CuisineWebsiteWeb.ErrorView, accepts: ~w(html json), layout: false],
  pubsub_server: CuisineWebsite.PubSub,
  live_view: [signing_salt: "LynpXfnG"]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{Mix.env()}.exs"

defmodule CuisineWebsite.Repo do
  use Ecto.Repo,
    otp_app: :cuisine_website,
    adapter: Ecto.Adapters.Postgres
end

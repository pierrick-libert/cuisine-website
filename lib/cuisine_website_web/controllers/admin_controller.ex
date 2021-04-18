defmodule CuisineWebsiteWeb.AdminController do
  use CuisineWebsiteWeb, :controller

  def index(conn, _params) do
    render(conn, "index.html")
  end
end

defmodule CuisineWebsiteWeb.Plugs.Lang do
  import Plug.Conn

  @langs ["en", "fr"]

  def init(default), do: default

  def call(%Plug.Conn{params: %{"lang" => lang}} = conn, _default) do
    if lang not in @langs do
      conn
      |> Phoenix.Controller.redirect(to: String.replace(conn.request_path, "/" <> lang <> "/", "/en/"))
      |> halt
    end
    conn
  end

end

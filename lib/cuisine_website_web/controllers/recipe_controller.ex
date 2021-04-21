defmodule CuisineWebsiteWeb.RecipeController do
  use CuisineWebsiteWeb, :controller

  def show(conn, %{"id" => id, "lang" => lang}) do
    conn
    |> assign(:id, id)
    |> assign(:lang, lang)
    |> render("show.html")
  end

  def show_all(conn, _opts) do
    conn
    |> assign(:recipes, [])
    |> render("list.html")
  end

  def show_admin(conn, _opts) do
    conn
    |> render("show_admin.html")
  end

  def new(conn, _opts) do
    conn
    |> render("create_update.html")
  end

  def get_update(conn, _opts) do
    conn
    |> render("create_update.html")
  end

  def create(conn, %{"tag" => tag_params}) do
    conn
    |> redirect(to: "/admin")
  end

  def update(conn, %{"id" => id, "tag" => tag_params}) do
    conn
    |> redirect(to: "/admin")
  end

end

defmodule CuisineWebsiteWeb.TagController do
  use CuisineWebsiteWeb, :controller

  def show_all(conn, %{"tag" => tag, "lang" => lang}) do
    conn
    |> assign(:tag, tag)
    |> assign(:lang, lang)
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
    |> assign(:tag_params, tag_params)
    |> redirect(to: "/admin")
  end

  def update(conn, %{"id" => id, "tag" => tag_params}) do
    conn
    |> assign(:id, id)
    |> assign(:tag_params, tag_params)
    |> redirect(to: "/admin")
  end

end

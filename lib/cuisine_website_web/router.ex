defmodule CuisineWebsiteWeb.Router do
  use CuisineWebsiteWeb, :router

  import Phoenix.LiveView.Router

  ## Admin Web App
  import CuisineWebsiteWeb.AuthController

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_flash
    plug :fetch_live_flash
    plug :put_root_layout, {CuisineWebsiteWeb.LayoutView, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :check_lang do
    plug CuisineWebsiteWeb.Plugs.Lang, "en"
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/:lang", CuisineWebsiteWeb do
    pipe_through([:browser, :check_lang])

    get "/", HomeController, :index
    get "/tags", TagController, :show_all
    # get "/recipe/tag/:tag", RecipeController, :show_by_tag
    get "/recipe/:id", RecipeController, :show
    live "/recipes", RecipeLive, :index
  end

  scope "/admin", CuisineWebsiteWeb do
    pipe_through([:browser, :redirect_if_admin_is_authenticated])

    get("/login", AuthController, :new)
    post("/login", AuthController, :create)

    get("/", AdminController, :index)

    get("/recipes", RecipeController, :show_admin)
    get("/recipe", RecipeController, :new)
    get("/recipe/:id", RecipeController, :get_update)
    post("/recipe", RecipeController, :create)
    put("/recipe/:id", RecipeController, :update)

    get("/tags", TagController, :show_admin)
    get("/tag", TagController, :new)
    get("/tag/:id", RecipeController, :get_update)
    post("/tag", TagController, :create)
    put("/tag/:id", TagController, :update)
  end

  scope "/admin", CuisineWebsiteWeb do
    pipe_through([:browser, :require_authenticated_admin])

    get("/logout", AuthController, :delete)
  end
end

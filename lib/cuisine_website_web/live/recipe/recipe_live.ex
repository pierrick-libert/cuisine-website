defmodule CuisineWebsiteWeb.RecipeLive do
  use CuisineWebsiteWeb, :live_view

  def render(assigns) do
    ~L"""
      <div class=recipes>
      <%= for recipe <- @recipes do %>
        <div class="recipe">
          <div class="img"><img src="<%= recipe.media %>"/></div>
          <div class="title"><%= recipe.title %></div>
        </div>
      <% end %>
      </div>
    """
  end

  def mount(_params, %{}, socket) do
    recipes = CuisineWebsite.Recipe.get_recipes()
    {:ok, assign(socket, :recipes, recipes)}
  end

  def handle_event("recipes_by_tag", _value, socket) do
    {:ok, recipes} = CuisineWebsite.Recipe.get_recipes_by_tag(socket.assigns.id)
    {:noreply, assign(socket, :recipes, recipes)}
  end
end

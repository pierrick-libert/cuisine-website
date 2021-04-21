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

  def mount(_params, %{"current_user_id" => user_id}, socket) do
    temperature = Thermostat.get_user_reading(user_id)
    {:ok, assign(socket, :temperature, temperature)}
  end

  def handle_event("recipes_by_tag", _value, socket) do
    {:ok, new_temp} = Thermostat.inc_temperature(socket.assigns.id)
    {:noreply, assign(socket, :temperature, new_temp)}
  end

end

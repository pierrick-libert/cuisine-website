defmodule CuisineWebsiteWeb.AuthController do
  use CuisineWebsiteWeb, :controller
  import Plug.Conn
  import Phoenix.Controller

  # Make the remember me cookie valid for 60 days.
  # If you want bump or reduce this value, also change
  # the token expiry itself in UserToken.
  @max_age 60 * 60 * 24 * 60
  @remember_me_cookie "_pog_web_user_remember_me"
  @remember_me_options [sign: true, max_age: @max_age, same_site: "Lax"]

  @doc """
  Logs the user in.

  It renews the session ID and clears the whole session
  to avoid fixation attacks. See the renew_session
  function to customize this behaviour.

  It also sets a `:live_socket_id` key in the session,
  so LiveView sessions are identified and automatically
  disconnected on log out.
  The line can be safely removed if we never use LiveView
  """
  def log_in_admin(conn, user, params \\ %{}) do
    token = CuisineWebsite.Auth.generate_admin_session_token(user)
    user_return_to = get_session(conn, :user_return_to)

    conn
    |> renew_session()
    |> put_session(:admin_token, token)
    |> put_session(:live_socket_id, "users_sessions:#{Base.url_encode64(token)}")
    |> maybe_write_remember_me_cookie(token, params)
    |> redirect(to: user_return_to || "/en/")
  end

  ## Pages
  def new(conn, _params) do
    render(conn, "login.html", error_message: nil)
  end

  def create(conn, %{"user" => user_params}) do
    %{"email" => email, "password" => password} = user_params

    if admin = CuisineWebsite.Auth.get_admin_by_email_and_password(email, password) do
      log_in_admin(conn, admin, user_params)
    else
      render(conn, "login.html", error_message: "Invalid email or password")
    end
  end

  def delete(conn, _params) do
    conn
    |> put_flash(:info, "Logged out successfully.")
    |> log_out_user()
  end

  @doc """
  Logs the user out.

  It clears all session data for safety. See renew_session.
  """
  def log_out_user(conn) do
    admin_token = get_session(conn, :admin_token)
    admin_token && CuisineWebsite.Auth.delete_session_token(admin_token)

    if live_socket_id = get_session(conn, :live_socket_id) do
      CuisineWebsiteWeb.Endpoint.broadcast(live_socket_id, "disconnect", %{})
    end

    conn
    |> renew_session()
    |> delete_resp_cookie(@remember_me_cookie)
    |> redirect(to: "/app")
  end

  ## Pipes

  @doc """
  Authenticates the user by looking into the session
  and remember me token.
  """
  def fetch_current_admin(conn, _opts) do
    {admin_token, conn} = ensure_admin_token(conn)
    admin = admin_token && CuisineWebsite.Auth.get_admin_by_session_token(admin_token)
    assign(conn, :current_admin, admin)
  end

  @doc """
  Used for routes that require the user to not be authenticated.
  """
  def redirect_if_admin_is_authenticated(conn, _opts) do
    if conn.assigns[:current_admin] do
      conn
      |> redirect(to: "/app")
      |> halt()
    else
      conn
    end
  end

  @doc """
  Used for routes that require the user to be authenticated.

  TODO: request email verification?
  """
  def require_authenticated_admin(conn, _opts) do
    if conn.assigns[:current_admin] do
      conn
    else
      conn
      |> redirect(to: "/app/login")
      |> halt()
    end
  end

  # This function renews the session ID and erases the whole
  # session to avoid fixation attacks. If there is any data
  # in the session you may want to preserve after log in/log out,
  # you must explicitly fetch the session data before clearing
  # and then immediately set it after clearing, for example:
  #
  #     defp renew_session(conn) do
  #       preferred_locale = get_session(conn, :preferred_locale)
  #
  #       conn
  #       |> configure_session(renew: true)
  #       |> clear_session()
  #       |> put_session(:preferred_locale, preferred_locale)
  #     end
  #
  defp renew_session(conn) do
    conn
    |> configure_session(renew: true)
    |> clear_session()
  end

  defp maybe_write_remember_me_cookie(conn, token, %{"remember_me" => "true"}) do
    put_resp_cookie(conn, @remember_me_cookie, token, @remember_me_options)
  end

  defp maybe_write_remember_me_cookie(conn, _token, _params) do
    conn
  end

  defp ensure_admin_token(conn) do
    if admin_token = get_session(conn, :admin_token) do
      {admin_token, conn}
    else
      conn = fetch_cookies(conn, signed: [@remember_me_cookie])

      if admin_token = conn.cookies[@remember_me_cookie] do
        {admin_token, put_session(conn, :user_token, admin_token)}
      else
        {nil, conn}
      end
    end
  end
end

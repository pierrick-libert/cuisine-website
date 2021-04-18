defmodule CuisineWebsite.Repo.Migrations.CreateUserTokens do
  use Ecto.Migration

  def change do
    create table(:user_tokens) do
      add :token, :binary
      add :context, :string
      add :sent_to, :string
      add :expired_at, :naive_datetime
      add :user_id, references(:users, on_delete: :nothing)

      timestamps()
    end

    create index(:user_tokens, [:user_id])

    alter table(:user_tokens) do
      modify(:inserted_at, :timestamp, default: fragment("NOW()"))
      modify(:updated_at, :timestamp, default: fragment("NOW()"))
    end
  end
end

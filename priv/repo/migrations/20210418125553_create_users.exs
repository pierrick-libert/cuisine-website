defmodule CuisineWebsite.Repo.Migrations.CreateUsers do
  use Ecto.Migration

  def change do
    create table(:users) do
      add :email, :string
      add :hashed_password, :string

      timestamps()
    end

    create unique_index(:users, [:email])

    alter table(:users) do
      modify(:inserted_at, :timestamp, default: fragment("NOW()"))
      modify(:updated_at, :timestamp, default: fragment("NOW()"))
    end
  end
end

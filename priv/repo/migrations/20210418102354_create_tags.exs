defmodule CuisineWebsite.Repo.Migrations.CreateTags do
  use Ecto.Migration

  def change do
    create table(:tags) do
      add :key, :string

      timestamps()
    end

    create unique_index(:tags, [:key])
  end
end

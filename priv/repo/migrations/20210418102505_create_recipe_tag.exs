defmodule CuisineWebsite.Repo.Migrations.CreateRecipeTag do
  use Ecto.Migration

  def change do
    create table(:recipe_tag) do
      add :recipe_id, references(:recipes, on_delete: :nothing)
      add :tag_id, references(:tags, on_delete: :nothing)

      timestamps()
    end

    create index(:recipe_tag, [:recipe_id])
    create index(:recipe_tag, [:tag_id])
  end
end

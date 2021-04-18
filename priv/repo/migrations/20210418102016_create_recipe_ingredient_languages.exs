defmodule CuisineWebsite.Repo.Migrations.CreateRecipeIngredientLanguages do
  use Ecto.Migration

  def change do
    create table(:recipe_ingredient_languages) do
      add :lang, :string
      add :name, :string
      add :recipe_id, references(:recipes, on_delete: :nothing)

      timestamps()
    end

    create index(:recipe_ingredient_languages, [:recipe_id])
  end
end

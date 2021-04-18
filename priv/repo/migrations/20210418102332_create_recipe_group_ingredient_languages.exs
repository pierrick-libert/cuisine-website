defmodule CuisineWebsite.Repo.Migrations.CreateRecipeGroupIngredientLanguages do
  use Ecto.Migration

  def change do
    create table(:recipe_group_ingredient_languages) do
      add :lang, :string
      add :quantity, :decimal
      add :unit, :string
      add :ingredient, :string
      add :recipe_ingredient_language_id, references(:recipe_ingredient_languages, on_delete: :nothing)

      timestamps()
    end

    create index(:recipe_group_ingredient_languages, [:recipe_ingredient_language_id])
  end
end

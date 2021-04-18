defmodule CuisineWebsite.Repo.Migrations.CreateRecipeLanguages do
  use Ecto.Migration

  def change do
    create table(:recipe_languages) do
      add :order, :integer
      add :lang, :string
      add :desc, :text
      add :media, :text
      add :recipe_id, references(:recipes, on_delete: :nothing)

      timestamps()
    end

    create index(:recipe_languages, [:recipe_id])
  end
end

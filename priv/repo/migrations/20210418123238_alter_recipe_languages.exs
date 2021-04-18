defmodule CuisineWebsite.Repo.Migrations.AlterRecipeLanguages do
  use Ecto.Migration

  def change do
    alter table(:recipe_languages) do
      remove_if_exists :media, :string
      remove_if_exists :order, :integer
    end
    rename table("recipe_languages"), :desc, to: :html
  end
end

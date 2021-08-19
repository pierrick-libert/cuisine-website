defmodule CuisineWebsite.Repo.Migrations.AddRLangTitle do
  use Ecto.Migration

  def change do
    alter table(:recipe_languages) do
      add :title, :string
    end
  end
end

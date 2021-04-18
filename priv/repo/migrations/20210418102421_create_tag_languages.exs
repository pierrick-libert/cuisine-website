defmodule CuisineWebsite.Repo.Migrations.CreateTagLanguages do
  use Ecto.Migration

  def change do
    create table(:tag_languages) do
      add :lang, :string
      add :name, :string
      add :tag_id, references(:tags, on_delete: :nothing)

      timestamps()
    end

    create index(:tag_languages, [:tag_id])
  end
end

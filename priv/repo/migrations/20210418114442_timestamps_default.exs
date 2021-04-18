defmodule CuisineWebsite.Repo.Migrations.TimestampsDefault do
  use Ecto.Migration

  def change do
    alter table(:recipe_group_ingredient_languages) do
      modify(:inserted_at, :timestamp, default: fragment("NOW()"))
      modify(:updated_at, :timestamp, default: fragment("NOW()"))
    end
    alter table(:recipe_ingredient_languages) do
      modify(:inserted_at, :timestamp, default: fragment("NOW()"))
      modify(:updated_at, :timestamp, default: fragment("NOW()"))
    end
    alter table(:recipe_languages) do
      modify(:inserted_at, :timestamp, default: fragment("NOW()"))
      modify(:updated_at, :timestamp, default: fragment("NOW()"))
    end
    alter table(:recipe_tag) do
      modify(:inserted_at, :timestamp, default: fragment("NOW()"))
      modify(:updated_at, :timestamp, default: fragment("NOW()"))
    end
    alter table(:recipes) do
      modify(:inserted_at, :timestamp, default: fragment("NOW()"))
      modify(:updated_at, :timestamp, default: fragment("NOW()"))
    end
    alter table(:tag_languages) do
      modify(:inserted_at, :timestamp, default: fragment("NOW()"))
      modify(:updated_at, :timestamp, default: fragment("NOW()"))
    end
    alter table(:tags) do
      modify(:inserted_at, :timestamp, default: fragment("NOW()"))
      modify(:updated_at, :timestamp, default: fragment("NOW()"))
    end
  end
end

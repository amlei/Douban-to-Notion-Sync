import "../../components/Collection/Collection.css";
import { Collection } from "../../components/Collection";
import { useCommunityData } from "../../hooks/useCommunityData";

export function DataManage() {
  const {
    books, wereadBooks, movies, notes, wereadBookmarks, flomoMemos,
    doubanBinding, wereadBinding, flomoBinding,
  } = useCommunityData();

  return (
    <Collection
      doubanBound={doubanBinding.bound}
      wereadBound={wereadBinding.bound}
      flomoBound={flomoBinding.bound}
      books={books}
      wereadBooks={wereadBooks}
      movies={movies}
      notes={notes}
      wereadBookmarks={wereadBookmarks}
      flomoMemos={flomoMemos}
    />
  );
}

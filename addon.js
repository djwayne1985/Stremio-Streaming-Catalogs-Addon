import axios from 'axios';

const AMOUNT = 250;
const AMOUNT_TO_VERIFY = 25;

export default {
    replaceRpdbPosters(rpdbKey, metas) {
        if (!rpdbKey) {
            return metas;
        }

        metas.forEach(meta => {
            meta.poster = `https://api.ratingposterdb.com/${rpdbKey}/imdb/poster-default/${meta.id}.jpg`;
        });

        return metas;
    },
    async getMetas(type = 'MOVIE', providers = ['nfx'], country = "GB", language = 'en') {
        let res = null;
        try {
            res = await axios.post('https://apis.justwatch.com/graphql', {
                "operationName": "GetPopularTitles",
                "variables": {
                    "popularTitlesSortBy": "TRENDING",
                    "first": AMOUNT,
                    "platform": "WEB",
                    "sortRandomSeed": 0,
                    "popularAfterCursor": "",
                    "popularTitlesFilter": {
                        "ageCertifications": [],
                        "excludeGenres": [],
                        "excludeProductionCountries": [],
                        "genres": [],
                        "objectTypes": [
                            type
                        ],
                        "productionCountries": [],
                        "packages": providers,
                        "excludeIrrelevantTitles": false,
                        "presentationTypes": [],
                        "monetizationTypes": [
                            "FREE",
                            "FLATRATE",
                            "ADS"
                        ]
                    },
                    "language": language,
                    "country": country
                },
                "query": "query GetPopularTitles(\n  $country: Country!\n  $popularTitlesFilter: TitleFilter\n  $popularAfterCursor: String\n  $popularTitlesSortBy: PopularTitlesSorting! = POPULAR\n  $first: Int!\n  $language: Language!\n  $sortRandomSeed: Int! = 0\n  $profile: PosterProfile\n  $backdropProfile: BackdropProfile\n  $format: ImageFormat\n) {\n  popularTitles(\n    country: $country\n    filter: $popularTitlesFilter\n    after: $popularAfterCursor\n    sortBy: $popularTitlesSortBy\n    first: $first\n    sortRandomSeed: $sortRandomSeed\n  ) {\n    totalCount\n    pageInfo {\n      startCursor\n      endCursor\n      hasPreviousPage\n      hasNextPage\n      __typename\n    }\n    edges {\n      ...PopularTitleGraphql\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment PopularTitleGraphql on PopularTitlesEdge {\n  cursor\n  node {\n    id\n    objectId\n    objectType\n    content(country: $country, language: $language) {\n      externalIds {\n        imdbId\n      }\n      title\n      fullPath\n      scoring {\n        imdbScore\n        __typename\n      }\n      posterUrl(profile: $profile, format: $format)\n      ... on ShowContent {\n        backdrops(profile: $backdropProfile, format: $format) {\n          backdropUrl\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}"
            });
        } catch (e) {
            console.error(e.message);
            console.log(e.response.data);

            return [];
        }

        console.log(providers.join(','), res.data.data.popularTitles.edges.length);

        return (await Promise.all(res.data.data.popularTitles.edges.map(async (item, index) => {
            let imdbId = item.node.content.externalIds.imdbId;

            if (!imdbId) {
                return null;
            }

            if (index < AMOUNT_TO_VERIFY) {
                try {
                    await axios.head(`https://www.imdb.com/title/${imdbId}/`, {maxRedirects: 0, headers: {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/110.0'}});
                } catch(e) {
                    if (e.response.status === 308) {
                        imdbId = e.response.headers?.['location']?.split('/')?.[2];
                        console.log('DUPE imdb redirects to', imdbId);
                    } else {
                        return null;
                    }
                }
            }

            const posterId = item?.node?.content?.posterUrl?.match(/\/poster\/([0-9]+)\//)?.pop();
            let posterUrl;
            if (posterId) {
                posterUrl = `https://images.justwatch.com/poster/${posterId}/s332/img`;
            } else {
                posterUrl = `https://live.metahub.space/poster/medium/${imdbId}/img`;
            }

            return {
                id: imdbId,
                name: item.node.content.title,
                poster: posterUrl,
                posterShape: 'poster',
                type: type === 'MOVIE' ? 'movie' : 'series',
            }
        }))).filter(item => item?.id);
    }
}
